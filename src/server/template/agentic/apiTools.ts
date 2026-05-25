/**
 * Auto-generate `AgenticTool[]` from API handlers that opted into the
 * agent surface.
 *
 * Each API handler file MAY co-locate an `apiMeta: ApiMeta` export
 * alongside the handler function. The domain's `server.ts` passes that
 * metadata into the registry entry as `meta`. This helper walks the
 * merged registry, keeps only entries with `meta.agentExposed === true`,
 * and produces one `AgenticTool` per opted-in API.
 *
 * Why opt-in: the registry includes admin endpoints, auth flows, etc.
 * Default-deny prevents accidentally giving the agent the keys.
 *
 * Why one tool per API (vs. a single generic `call_api` tool): the
 * model gets each input schema upfront — no extra discovery hop, no
 * hallucinated API names, native SDK validation. If the surface
 * eventually grows past ~30 APIs, switch to a `list_apis` +
 * `get_api_schema` + `call_api` discovery pattern instead.
 */

import { z } from 'zod';
import type {
    ApiHandlerContext,
    ApiHandlersWithMeta,
    ApiMeta,
} from '@/apis/types';
import type { AgenticTool, AgenticToolContext, ToolResult } from './types';

/**
 * Synthesize an `ApiHandlerContext` for an agent-side handler call.
 *
 * - `userId` flows through from the agent's tool context
 * - `isAdmin` is always false — the agent must never elevate privileges
 *   on its caller's behalf
 * - Cookie ops are inert no-ops — the agent runs in the daemon outside
 *   any HTTP request, so cookie-dependent flows (auth, RPC connection
 *   gate) intentionally cannot be invoked via the agent
 */
function synthesizeApiContext(userId: string): ApiHandlerContext {
    return {
        userId,
        isAdmin: false,
        getCookieValue: () => undefined,
        setCookie: () => {
            /* no-op: agent has no HTTP response */
        },
        clearCookie: () => {
            /* no-op: agent has no HTTP response */
        },
    };
}

/**
 * Convert an API name like `'todos/getTodos'` into a tool name that's
 * safe across SDKs — Codex requires identifier-safe names, Claude
 * Code allows dots/hyphens but underscores are universally safe.
 */
function apiNameToToolName(apiName: string): string {
    return `api__${apiName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

export interface BuildAgentToolsOptions {
    /** The merged `apiHandlers` registry (includes `meta` per entry). */
    handlers: ApiHandlersWithMeta;
    /** Optional extra filter on top of `agentExposed: true`. Useful to
     *  scope per-conversation: e.g. only allow `todos/*` for a "todo
     *  assistant" conversation. */
    filter?: (apiName: string, meta: ApiMeta) => boolean;
}

export function buildAgentToolsFromApis(
    opts: BuildAgentToolsOptions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool shapes
): Array<AgenticTool<any, unknown>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous tool shapes
    const out: Array<AgenticTool<any, unknown>> = [];
    // Tool names are derived from API names by replacing every
    // non-identifier char with '_'. Two distinct API names can collapse
    // to the same tool name (e.g. 'a/b' and 'a-b' both become
    // 'api__a_b'). The SDK's tool-call dispatch is undefined in that
    // case, so fail loudly at build time rather than ship a flaky
    // ambiguous tool surface.
    const toolNameToApiName = new Map<string, string>();

    for (const [apiName, entry] of Object.entries(opts.handlers)) {
        const meta = entry.meta;
        if (!meta || !meta.agentExposed) continue;
        if (opts.filter && !opts.filter(apiName, meta)) continue;

        const toolName = apiNameToToolName(apiName);
        const existing = toolNameToApiName.get(toolName);
        if (existing) {
            throw new Error(
                `[agent-api-tools] Tool name collision: "${toolName}" derives from both API "${existing}" and API "${apiName}". Rename one of the APIs so they don't collapse to the same tool name.`
            );
        }
        toolNameToApiName.set(toolName, apiName);

        const inputSchemaObject = z.object(meta.inputSchema);

        out.push({
            name: toolName,
            description: `${meta.description} (Calls the project API "${apiName}".)`,
            inputSchema: meta.inputSchema,
            didMutate: meta.mutates
                ? (_args, result) => result.ok
                : undefined,
            handler: async (args, ctx: AgenticToolContext<unknown>): Promise<ToolResult> => {
                // The agentic engine already validated `args` against
                // `inputSchema` before calling us — but parse a second
                // time here so the variable carries the right TS type
                // (the engine passes `args as never` for cross-shape
                // dispatch).
                const parsed = inputSchemaObject.safeParse(args);
                if (!parsed.success) {
                    return {
                        ok: false,
                        error: parsed.error.issues
                            .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
                            .join('; '),
                    };
                }
                const apiCtx = synthesizeApiContext(ctx.userId);
                try {
                    const result = await entry.process(
                        parsed.data as unknown,
                        apiCtx
                    );
                    // API handlers return `{ error }` for soft failures
                    // (validation, not-found, unauthorized) and throw
                    // for unexpected errors. Normalize both into the
                    // ToolResult envelope so the model can react.
                    if (
                        result &&
                        typeof result === 'object' &&
                        'error' in result &&
                        typeof (result as { error?: unknown }).error === 'string'
                    ) {
                        return {
                            ok: false,
                            error: (result as { error: string }).error,
                        };
                    }
                    return { ok: true, data: result };
                } catch (err) {
                    return {
                        ok: false,
                        error: err instanceof Error ? err.message : String(err),
                    };
                }
            },
        });
    }
    return out;
}

// Note: `ApiMeta` and `ApiHandlersWithMeta` are re-exported from the
// agentic barrel (`index.ts`) so projects can pull them via
// `@/server/template/agentic` without reaching into `apis/types`.
