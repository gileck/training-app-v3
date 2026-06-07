/**
 * Provider-neutral types for the agentic LLM layer.
 *
 * Lives in the template — no domain coupling. Each project's agent
 * (ai-doctor, fitness-training, diet-coach, finance-manager) narrows
 * `TData` to its own `DataContext` and supplies its own tool list +
 * conversations collection adapter.
 *
 * An adapter wraps an agentic LLM SDK (Claude Code, Codex, …) and must:
 *   1. Accept a list of `AgenticTool`s with Zod-shaped args
 *   2. Run the tool-use loop internally (we do NOT parse JSON ourselves)
 *   3. Emit incremental `AgentEvent`s for UI streaming via `onEvent`
 *   4. Return a final answer + total cost
 *
 * The event shape is intentionally limited to four kinds that map well
 * onto a "thinking timeline" UI. Richer provider events should collapse
 * into one of these at the adapter boundary.
 */

import type { ObjectId } from 'mongodb';
import type { z } from 'zod';

// ─── tool envelope ─────────────────────────────────────────────────────────

/**
 * Generic envelope every tool returns. Adapters JSON-serialize this and
 * feed it back into the model loop. Domain-specific payload lives in
 * `data` — keep it small (~10 KB cap is a good rule of thumb).
 */
export interface ToolResult {
    ok: boolean;
    data?: unknown;
    error?: string;
    truncated?: boolean;
    hint?: string;
}

// ─── tool definitions ──────────────────────────────────────────────────────

/**
 * Zod raw-shape — the object passed to `z.object({ ... })`. Matches the
 * Claude Code SDK's native `tool()` signature and converts trivially to
 * JSON Schema for adapters that need it.
 */
export type ZodRawShape = Record<string, z.ZodTypeAny>;

/**
 * One tool the agent can call. Adapter is responsible for translating
 * this into its SDK's native tool-call format and dispatching to the
 * handler when the model invokes it. The handler receives args already
 * validated against the schema — adapters run Zod validation at the
 * boundary so handlers can trust the input.
 *
 * `TData` is the per-turn data context type the project supplies. The
 * template's generic tools (e.g. `read_file`) leave it as `unknown` and
 * ignore `ctx.data`. Domain tools narrow it to their `DataContext`.
 */
export interface AgenticTool<
    Shape extends ZodRawShape = ZodRawShape,
    TData = unknown,
> {
    name: string;
    description: string;
    inputSchema: Shape;
    handler: (
        args: z.infer<z.ZodObject<Shape>>,
        ctx: AgenticToolContext<TData>
    ) => Promise<ToolResult>;
    /** Optional. Did this call mutate user data? Drives the UI's
     *  "Saved" chip and the trace `wrote` flag. Defaults to `false` if
     *  absent — read-only tools can omit it. */
    didMutate?: (
        args: z.infer<z.ZodObject<Shape>>,
        result: ToolResult
    ) => boolean;
}

/**
 * Per-turn context passed to every tool handler. `data` is the
 * project-supplied per-turn cache (e.g. ai-doctor's `DataContext` with
 * marker docs, profile, etc.). The same context object is used for the
 * whole turn — tools that mutate state call into `data` to refresh the
 * cache for subsequent tools in the same turn.
 */
export interface AgenticToolContext<TData = unknown> {
    userId: string;
    conversationId: ObjectId;
    data: TData;
    /** ObjectId of the assistant turn being produced, as a hex string —
     *  used by write tools to backlink saved items to the chat message
     *  that produced them. */
    sourceMessageId: string;
}

// ─── events ────────────────────────────────────────────────────────────────

export type AgentEvent =
    | { type: 'thinking'; content: string; at: string }
    | { type: 'tool_call'; callId: string; name: string; args: Record<string, unknown>; at: string }
    | {
          type: 'tool_result';
          callId: string;
          name: string;
          ok: boolean;
          truncated: boolean;
          /** True only when this call actually mutated user data — false
           *  for read tools, errors, and approval-guard noops (writes
           *  that returned { requiresApproval: true }). Used by the UI
           *  to power the "Saved" chip beneath the assistant message. */
          wrote: boolean;
          at: string;
          /** Short human-readable summary the timeline UI can show
           *  without revealing the full payload. */
          summary?: string;
      }
    | { type: 'message'; content: string; at: string };

// ─── adapter interface ─────────────────────────────────────────────────────

/**
 * Provider-neutral reasoning-effort knob. Each adapter translates this
 * to its SDK's native format (Codex `modelReasoningEffort`, Claude Code
 * `maxThinkingTokens`, etc).
 *
 * Rough mental model:
 *  - low    → snap, no/little deliberation (trivial chat)
 *  - medium → default for most questions
 *  - high   → multi-step analysis, gather + reason
 *  - xhigh  → hard problems where you'd otherwise split into turns
 */
export type AgenticEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface AgenticRunOptions<TData = unknown> {
    modelId: string;
    systemPrompt: string;
    /** Prior turns, in chronological order. Each entry's role is
     *  'user' | 'assistant'. The adapter is responsible for translating
     *  to its SDK's message format. */
    history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
    /** The new user message for this turn. */
    userText: string;
    /** Optional public image URLs to attach to the user message as
     *  vision content blocks. Adapters that support multimodal input
     *  (e.g. Claude Code via Anthropic image blocks) MUST pass these
     *  alongside `userText` so the model can actually see the image.
     *  Adapters without vision support should fall back to inlining
     *  the URLs in `userText` server-side. */
    userImageUrls?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool shapes
    tools: AgenticTool<any, TData>[];
    /** Passed to every tool handler when the model invokes it. */
    toolContext: AgenticToolContext<TData>;
    /** Optional provider-side session id to resume. When present, the
     *  adapter should resume the session rather than starting fresh —
     *  prior conversation history lives in the provider's session store
     *  and doesn't need to be re-serialised in the prompt. */
    resumeSessionId?: string;
    /** Called as soon as each event happens. Adapters MUST call this
     *  before/after each tool dispatch so the daemon can persist events
     *  to MongoDB for client polling. */
    onEvent?: (event: AgentEvent) => Promise<void>;
    /** Hard cap on the number of model→tool→model loops in this turn.
     *  Adapters must respect this. */
    maxIterations?: number;
    /** How hard the model should think before answering. Each adapter
     *  maps this to its native format. Default = 'medium' if absent. */
    effort?: AgenticEffort;
}

export interface TurnTokenUsage {
    input: number;
    output: number;
}

export interface AgenticResult {
    /** Final assistant message text. */
    finalText: string;
    /** Every event that fired during the turn, in order. Includes the
     *  same events streamed to `onEvent`. */
    events: AgentEvent[];
    /** Total cost for this turn in USD. */
    cost: number;
    /** Total token usage for this turn (sum across all models). Both
     *  adapters populate this; absent only when the SDK didn't report
     *  usage (extremely rare, e.g. crash before any model call). */
    tokens?: TurnTokenUsage;
    /** Reason the loop ended: 'final' (model produced final answer),
     *  'max_iterations' (hit cap), 'error' (adapter or tool threw). */
    finishReason: 'final' | 'max_iterations' | 'error';
    /** Provider-side session id for this turn (whether resumed or
     *  freshly created). The handler persists it onto the conversation
     *  so the next turn can resume. */
    sessionId?: string;
}

export interface AgenticAdapter {
    /** Stable identifier (e.g. 'claude-code', 'codex'). */
    readonly name: string;
    /** Returns true if this adapter handles the given model id. */
    supportsModel(modelId: string): boolean;
    /** Adapters never inspect `ctx.data` — they just forward it to tool
     *  handlers — so `TData` stays `any` at this boundary. Callers
     *  supply a narrowed `AgenticRunOptions<MyDataContext>`. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance: see comment above
    runAgent(opts: AgenticRunOptions<any>): Promise<AgenticResult>;
}

// ─── adapter configuration ─────────────────────────────────────────────────

/**
 * Env var the Codex adapter sets to pass the per-turn JSON context
 * (userId, conversationId, sourceMessageId) to the spawned MCP server.
 * Constant because only one Codex MCP subprocess runs per turn — no
 * risk of cross-agent collision — so there's no reason to parameterize.
 */
export const AGENTIC_MCP_CONTEXT_ENV_VAR = 'AGENTIC_MCP_CONTEXT';

/**
 * Per-agent configuration handed to both adapter constructors. Each
 * adapter uses the fields relevant to its SDK and ignores the rest.
 * Build one of these per agent (in the project's handler.ts) and pass
 * it to every adapter you instantiate.
 *
 * Designed to be minimal: only `agentName` is required. Everything
 * else is derived from it by convention, with optional overrides for
 * projects that don't follow the convention.
 */
export interface AgenticAdapterConfig {
    /**
     * Stable agent slug — e.g. 'ai-doctor', 'fitness-training'.
     * Drives:
     *   - log prefix `[${agentName}]`
     *   - Claude Code MCP server name (used as-is, hyphens OK)
     *   - Codex `mcp_servers` map key (hyphens → underscores so it's
     *     identifier-safe, as Codex requires)
     *   - default `codexMcpServerPath` (see below)
     */
    agentName: string;

    /**
     * Absolute path to the project's codex-mcp-server.ts bootstrap.
     * Codex spawns this file as a subprocess per turn.
     *
     * Defaults to the agent convention path
     * `src/server/project/agent/adapters/codex-mcp-server.ts` — the same
     * folder the daemon resolves the handler from. Override only if your
     * project's Codex bootstrap lives elsewhere.
     */
    codexMcpServerPath?: string;

    /**
     * Optional sentence appended to the Codex user-message prompt.
     * Useful when Codex's native filesystem/web tools shouldn't be
     * used this turn — e.g. "Use the ai_doctor MCP tools for
     * lab/profile data. Do not inspect or edit repository files."
     * Claude Code doesn't use this (its tool surface is locked by
     * `allowedTools`).
     */
    codexMcpInstruction?: string;
}

/** Default Codex MCP server path — the agent convention path. Constant
 *  (not derived from agentName) so it matches the single
 *  `src/server/project/agent/` folder the handler also lives in. */
export function defaultCodexMcpServerPath(): string {
    return 'src/server/project/agent/adapters/codex-mcp-server.ts';
}

/** Codex requires `mcp_servers` keys to be identifier-safe; Claude Code
 *  is fine with hyphens. */
export function codexMcpServerKeyFor(agentName: string): string {
    return agentName.replace(/-/g, '_');
}
