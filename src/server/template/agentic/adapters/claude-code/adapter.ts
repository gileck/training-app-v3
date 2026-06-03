/**
 * Claude Code SDK adapter for the generic agentic engine.
 *
 * Wraps `@anthropic-ai/claude-agent-sdk`'s `query()` + `createSdkMcpServer`
 * so callers stay provider-neutral. The project supplies a list of
 * `AgenticTool`s (Zod-shaped); the adapter translates them to the SDK's
 * native MCP tool format. The SDK runs the agentic loop internally; we
 * translate its message stream into our unified `AgentEvent[]` for the
 * UI timeline.
 *
 * Cost is taken from the SDK's `total_cost_usd` on the result message.
 */

import { randomUUID } from 'crypto';
import {
    createSdkMcpServer,
    query,
    tool,
    type SDKMessage,
    type SDKResultMessage,
    type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { summarizeToolResult } from '../../eventSummary';
import type {
    AgenticAdapter,
    AgenticAdapterConfig,
    AgentEvent,
    AgenticEffort,
    AgenticResult,
    AgenticRunOptions,
    AgenticTool,
    AgenticToolContext,
} from '../../types';

/**
 * Map the shared effort enum to Claude Code's `maxThinkingTokens`.
 * Numbers picked to roughly match what an equivalent Codex preset
 * would burn — tune if investigations come back short or over-baked.
 */
function thinkingTokensForEffort(effort: AgenticEffort): number {
    switch (effort) {
        case 'low': return 0;       // skip extended thinking entirely
        case 'medium': return 4000;
        case 'high': return 16000;
        case 'xhigh': return 32000;
    }
}

/**
 * The short model ids we expose in the UI map to actual Anthropic
 * model identifiers here. Kept in lockstep with `CLAUDE_CODE_MODELS`
 * in `src/common/ai/models.ts`.
 */
const MODEL_MAP: Record<string, string> = {
    'claude-code-haiku': 'claude-haiku-4-5-20251001',
    'claude-code-sonnet': 'claude-sonnet-4-5-20250929',
    'claude-code-opus': 'claude-opus-4-6',
};

/**
 * Default cap on model→tool→model loops per turn. Investigations
 * routinely need 10-15 turns for a real analysis, so 8 (the SDK's
 * de-facto chat default) was too tight and produced error_max_turns
 * failures. At Sonnet pricing 20 turns caps a single question at
 * roughly $0.20 worst-case.
 */
const DEFAULT_MAX_ITERATIONS = 20;

function now(): string {
    return new Date().toISOString();
}

/**
 * Convert one of our internal ToolResult envelopes into the MCP-style
 * CallToolResult shape the SDK expects from a tool handler.
 */
function toolResultToMcpReply(result: {
    ok: boolean;
    data?: unknown;
    error?: string;
    truncated?: boolean;
    hint?: string;
}) {
    // The model reads the payload as a stringified JSON blob — keeping
    // the original envelope intact preserves the contract our prompt has
    // been trained against (ok / data / error / truncated / hint).
    return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        isError: !result.ok,
    };
}

export class ClaudeCodeAgenticAdapter implements AgenticAdapter {
    readonly name = 'claude-code';

    constructor(private readonly config: AgenticAdapterConfig) {}

    supportsModel(modelId: string): boolean {
        return modelId in MODEL_MAP;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance on TData; we forward ctx through
    async runAgent(opts: AgenticRunOptions<any>): Promise<AgenticResult> {
        const sdkModelId = MODEL_MAP[opts.modelId];
        if (!sdkModelId) {
            throw new Error(`Claude Code adapter does not handle model "${opts.modelId}"`);
        }

        const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
        const logPrefix = `[${this.config.agentName}]`;
        // Claude Code accepts the agent slug as-is for its MCP server
        // identifier (hyphens OK). The name is internal — only used in
        // `mcp__<name>__<tool>` allowed-tools strings, the mcpServers
        // map key, and the SDK's serverInfo. Persists nothing.
        const mcpServerName = this.config.agentName;

        const events: AgentEvent[] = [];
        const emit = async (event: AgentEvent) => {
            events.push(event);
            await opts.onEvent?.(event);
        };

        // Wrap each AgenticTool into an SDK tool. The wrapper emits
        // tool_call/tool_result events around the underlying handler so
        // the timeline shows every tool the agent ran. The ToolContext
        // is captured from the closure — the SDK doesn't expose a way
        // to pass per-call context, which is fine because we have one
        // adapter instance per turn.
        const mcpTools = opts.tools.map((t) => buildSdkTool(t, opts.toolContext, emit));

        const mcp = createSdkMcpServer({
            name: mcpServerName,
            version: '1.0.0',
            tools: mcpTools,
        });

        // Session-resume mode: when the conversation already has a
        // session id, hand it to the SDK via `resume` — the SDK loads
        // prior turns from its own session store, and we skip the
        // history-in-system-prompt serialisation that would otherwise
        // cost ~all of the conversation again in tokens. First-turn
        // (no sessionId) falls back to serialised history.
        const resuming = !!opts.resumeSessionId;
        const fullSystemPrompt = resuming
            ? opts.systemPrompt
            : buildSystemPromptWithHistory(opts.systemPrompt, opts.history);

        // Two SDK options control tool access:
        //   `tools`        — the base set of BUILT-IN tools the model
        //                    can see (Bash, Read, WebSearch, etc.)
        //   `allowedTools` — auto-approves named tools so the SDK
        //                    doesn't prompt for permission.
        // MCP tools (ours) come via `mcpServers` and don't need to be
        // in `tools`. Native tools (WebSearch / WebFetch) DO need to
        // be in `tools` to be enabled at all.
        const nativeBuiltInTools = ['WebSearch', 'WebFetch'];
        const allowedTools = [
            ...opts.tools.map((t) => `mcp__${mcpServerName}__${t.name}`),
            ...nativeBuiltInTools,
        ];

        // Claude Code controls reasoning via a TOKEN budget, not a
        // preset. Translate our shared 'low'/'medium'/'high'/'xhigh'
        // enum to a token cap. 'low' uses 0 so the model skips extended
        // thinking entirely (fastest + cheapest).
        const maxThinkingTokens = thinkingTokensForEffort(opts.effort ?? 'medium');

        // When images are attached we have to use the AsyncIterable
        // prompt form — a plain string can't carry image content
        // blocks, and the SDK's `query()` only accepts `string |
        // AsyncIterable<SDKUserMessage>`. The text-only path stays
        // on the string form so we don't change the SDK's request
        // shape for the common case.
        //
        // We fetch each image server-side and embed it as a base64
        // content block rather than passing the URL through. Two
        // reasons: (1) Anthropic's URL image source is honored by
        // their REST API but the Claude Code CLI bridge that this
        // SDK wraps doesn't always pass URL sources through cleanly;
        // (2) base64 is the universally supported path. The fetch
        // happens once per turn, before the SDK call.
        const imageUrls = opts.userImageUrls ?? [];
        let prompt: string | AsyncIterable<SDKUserMessage>;
        if (imageUrls.length === 0) {
            prompt = opts.userText;
        } else {
            const images = await Promise.all(
                imageUrls.map((url) => fetchImageAsBase64(url, logPrefix))
            );
            prompt = makeMultimodalUserPrompt(opts.userText, images);
        }

        const stream = query({
            prompt,
            options: {
                model: sdkModelId,
                mcpServers: { [mcpServerName]: mcp },
                tools: nativeBuiltInTools,
                allowedTools,
                maxTurns: maxIterations,
                maxThinkingTokens,
                // Default `persistSession` is true; explicit for clarity.
                // We rely on saved sessions so the next turn can resume.
                persistSession: true,
                ...(opts.resumeSessionId ? { resume: opts.resumeSessionId } : {}),
                systemPrompt: fullSystemPrompt,
                permissionMode: 'bypassPermissions',
            },
        });

        const tracker = makeNativeCallTracker();
        let result: SDKResultMessage | null = null;
        try {
            for await (const message of stream as AsyncIterable<SDKMessage>) {
                await translateMessage(message, emit, tracker);
                if (message.type === 'result') {
                    result = message as SDKResultMessage;
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`${logPrefix} Claude Code SDK stream threw:`, err);
            return {
                finalText: `Sorry — the agent crashed: ${msg}. Try again or pick a different model.`,
                events,
                cost: 0,
                finishReason: 'error',
            };
        }

        if (!result) {
            return {
                finalText:
                    'The agent ended without a final answer. Try again or pick a different model.',
                events,
                cost: 0,
                finishReason: 'error',
            };
        }

        if (result.subtype !== 'success') {
            const errorList =
                'errors' in result && Array.isArray((result as { errors?: unknown }).errors)
                    ? (result as { errors: string[] }).errors
                    : [];
            const detail = errorList.length > 0 ? errorList.join('; ') : result.subtype;
            // Daemon stdout — task-cli daemon logs surfaces this for debugging.
            console.error(`${logPrefix} Claude Code SDK returned non-success`, {
                subtype: result.subtype,
                num_turns: result.num_turns,
                maxIterations,
                errors: errorList,
                permission_denials: result.permission_denials,
                eventCount: events.length,
                toolCallCount: events.filter((e) => e.type === 'tool_call').length,
                toolNames: events
                    .filter((e): e is Extract<AgentEvent, { type: 'tool_call' }> => e.type === 'tool_call')
                    .map((e) => e.name),
            });
            return {
                finalText: `Sorry — the agent failed: ${detail}. Try again or pick a different model.`,
                events,
                cost: result.total_cost_usd ?? 0,
                tokens: sumModelUsage(result.modelUsage),
                finishReason: 'error',
                sessionId: result.session_id,
            };
        }

        return {
            finalText: result.result,
            events,
            cost: result.total_cost_usd ?? 0,
            tokens: sumModelUsage(result.modelUsage),
            finishReason: result.num_turns >= maxIterations ? 'max_iterations' : 'final',
            sessionId: result.session_id,
        };
    }
}

/** Collapse the SDK's per-model `modelUsage` map into a single
 *  {input, output} pair. Cache reads/creates are folded into input —
 *  the bubble doesn't need the breakdown, just total. */
function sumModelUsage(
    modelUsage: SDKResultMessage['modelUsage'] | undefined
): { input: number; output: number } | undefined {
    if (!modelUsage) return undefined;
    let input = 0;
    let output = 0;
    for (const usage of Object.values(modelUsage)) {
        input +=
            (usage.inputTokens ?? 0) +
            (usage.cacheReadInputTokens ?? 0) +
            (usage.cacheCreationInputTokens ?? 0);
        output += usage.outputTokens ?? 0;
    }
    return { input, output };
}

/** Anthropic only accepts these as image media types via the
 *  base64-source path. Anything else (or empty) is coerced to png. */
type AnthropicImageMediaType =
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp';

interface InlineImage {
    /** Base64-encoded image bytes. */
    data: string;
    mediaType: AnthropicImageMediaType;
}

function normalizeMediaType(raw: string): AnthropicImageMediaType {
    const lower = raw.toLowerCase();
    if (lower === 'image/jpeg' || lower === 'image/jpg') return 'image/jpeg';
    if (lower === 'image/gif') return 'image/gif';
    if (lower === 'image/webp') return 'image/webp';
    return 'image/png';
}

/**
 * Fetch a public image URL, base64-encode it, and tag with its media
 * type. Used by the multimodal path because the SDK's CLI bridge
 * doesn't reliably pass `{ source: { type: 'url' } }` through.
 */
async function fetchImageAsBase64(
    url: string,
    logPrefix: string
): Promise<InlineImage> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(
            `${logPrefix} failed to fetch image attachment (${res.status}): ${url}`
        );
    }
    const arrayBuf = await res.arrayBuffer();
    return {
        data: Buffer.from(arrayBuf).toString('base64'),
        mediaType: normalizeMediaType(res.headers.get('content-type') ?? ''),
    };
}

/**
 * Build a single-message AsyncIterable for query() carrying a
 * multimodal user turn. The model sees the text alongside each image
 * as a separate base64-source content block — that's what
 * vision-capable models need to actually look at the image.
 *
 * `session_id` is required by the SDK type; we pass a UUID. When the
 * caller supplied `resume`, the SDK uses options.resume (set at the
 * query() call site) to anchor the conversation — the inline
 * session_id here only labels this single yielded message.
 */
async function* makeMultimodalUserPrompt(
    text: string,
    images: ReadonlyArray<InlineImage>
): AsyncIterable<SDKUserMessage> {
    yield {
        type: 'user',
        message: {
            role: 'user',
            content: [
                { type: 'text', text },
                ...images.map((img) => ({
                    type: 'image' as const,
                    source: {
                        type: 'base64' as const,
                        media_type: img.mediaType,
                        data: img.data,
                    },
                })),
            ],
        },
        parent_tool_use_id: null,
        session_id: randomUUID(),
    };
}

function buildSystemPromptWithHistory(
    systemPrompt: string,
    history: AgenticRunOptions['history']
): string {
    if (history.length === 0) return systemPrompt;
    const turns = history.map(
        (m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    );
    return [systemPrompt, '', '=== PRIOR CONVERSATION ===', ...turns].join('\n');
}

function buildSdkTool(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool list
    agenticTool: AgenticTool<any, any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- forwarded through; adapter doesn't inspect
    ctx: AgenticToolContext<any>,
    emit: (e: AgentEvent) => Promise<void>
) {
    return tool(
        agenticTool.name,
        agenticTool.description,
        agenticTool.inputSchema,
        async (args: unknown) => {
            const callId = new ObjectId().toHexString();
            await emit({
                type: 'tool_call',
                callId,
                name: agenticTool.name,
                args: args as Record<string, unknown>,
                at: now(),
            });
            const result = await agenticTool.handler(
                args as z.infer<z.ZodObject<typeof agenticTool.inputSchema>>,
                ctx
            );
            await emit({
                type: 'tool_result',
                callId,
                name: agenticTool.name,
                ok: result.ok,
                truncated: !!result.truncated,
                wrote: agenticTool.didMutate?.(args as never, result) ?? false,
                summary: summarizeToolResult(agenticTool.name, result),
                at: now(),
            });
            return toolResultToMcpReply(result);
        }
    );
}

/**
 * Pull thinking / message / native-tool events out of the SDK message
 * stream.
 *
 * MCP tools (the agent's own) emit tool_call / tool_result events from
 * the tool wrappers above — we DON'T re-emit them here or we'd
 * double-count.
 *
 * Native SDK tools (WebSearch, WebFetch) run server-side at Anthropic —
 * the SDK emits tool_use blocks (assistant messages) when the model
 * invokes them, and tool_result blocks (user messages) when results
 * come back. We translate those into our AgentEvent shape so the UI
 * timeline shows native-tool activity alongside MCP tools.
 */

/** Per-turn lookup used by translateMessage to pair native tool_use
 *  blocks with their matching tool_result blocks, and to filter out
 *  MCP tool_result blocks (whose events come from the wrapper). */
interface NativeCallTracker {
    seen: Set<string>;
    names: Map<string, string>;
}

function makeNativeCallTracker(): NativeCallTracker {
    return { seen: new Set(), names: new Map() };
}

async function translateMessage(
    msg: SDKMessage,
    emit: (e: AgentEvent) => Promise<void>,
    tracker: NativeCallTracker
): Promise<void> {
    if (msg.type === 'assistant') {
        const content = msg.message.content;
        if (!Array.isArray(content)) return;
        for (const block of content) {
            if (block.type === 'thinking' && typeof block.thinking === 'string') {
                await emit({ type: 'thinking', content: block.thinking, at: now() });
            } else if (block.type === 'text' && typeof block.text === 'string') {
                await emit({ type: 'message', content: block.text, at: now() });
            } else if (block.type === 'tool_use' && isNativeToolName(block.name)) {
                tracker.seen.add(block.id);
                tracker.names.set(block.id, block.name);
                await emit({
                    type: 'tool_call',
                    callId: block.id,
                    name: block.name,
                    args: (block.input as Record<string, unknown>) ?? {},
                    at: now(),
                });
            }
        }
        return;
    }
    if (msg.type === 'user') {
        const content = msg.message.content;
        if (!Array.isArray(content)) return;
        for (const block of content) {
            if (block.type !== 'tool_result') continue;
            const blockId = (block as { tool_use_id?: unknown }).tool_use_id;
            if (typeof blockId !== 'string') continue;
            // Only emit when this result pairs with a previously-
            // emitted NATIVE tool_call. MCP tool results already came
            // through the tool wrapper, so re-emitting here would
            // double-count in the timeline.
            if (!tracker.seen.has(blockId)) continue;
            const isError = (block as { is_error?: unknown }).is_error === true;
            const summary = summarizeNativeToolResult(block);
            const callName = tracker.names.get(blockId) ?? 'web';
            tracker.seen.delete(blockId);
            tracker.names.delete(blockId);
            await emit({
                type: 'tool_result',
                callId: blockId,
                name: callName,
                ok: !isError,
                truncated: false,
                wrote: false,
                summary,
                at: now(),
            });
        }
    }
}


/**
 * Native SDK tools — Anthropic runs these server-side. Currently
 * WebSearch + WebFetch; add more here if/when more native tools are
 * whitelisted in `allowedTools` above.
 */
const NATIVE_TOOL_NAMES = new Set(['WebSearch', 'WebFetch']);

function isNativeToolName(name: unknown): name is string {
    return typeof name === 'string' && NATIVE_TOOL_NAMES.has(name);
}

/**
 * Short label for a native tool result. Native results come back as
 * structured content blocks (WebSearch returns search-results blocks;
 * WebFetch returns fetched-content blocks). For the timeline we just
 * want a brief "done"-style indicator.
 */
function summarizeNativeToolResult(block: unknown): string {
    if (!block || typeof block !== 'object') return 'done';
    const content = (block as { content?: unknown }).content;
    if (typeof content === 'string') return truncateForSummary(content);
    if (Array.isArray(content)) {
        // Count search-result-like entries when present.
        return `Returned ${content.length} item(s)`;
    }
    return 'done';
}

function truncateForSummary(s: string): string {
    const trimmed = s.replace(/\s+/g, ' ').trim();
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
}
