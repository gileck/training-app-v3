import type {
    ApiHandlerContext,
    ApiHandlersWithMeta,
    ApiMeta,
} from "./types";

/**
 * Helper for building the API registry with minimal boilerplate.
 *
 * Domain modules can export a simple object:
 *   { [API_NAME]: { process: someHandler } }
 *
 * The registry requires a generic `(unknown, context)` signature, but domain handlers
 * naturally use strongly-typed payloads. We centralize the necessary cast here so
 * `src/apis/apis.ts` stays clean.
 *
 * Domain entries MAY also include `meta: ApiMeta` for endpoints that
 * opt into the agent tool surface (see `buildAgentToolsFromApis`).
 * `meta` is preserved verbatim onto the merged registry.
 */
export type LooseApiHandlers = Record<string, {
    process: unknown;
    meta?: ApiMeta;
}>;

export function mergeApiHandlers(
    ...sources: LooseApiHandlers[]
): ApiHandlersWithMeta {
    const out: ApiHandlersWithMeta = {};

    for (const source of sources) {
        for (const [key, handler] of Object.entries(source)) {
            if (process.env.NODE_ENV !== "production" && key in out) {
                throw new Error(`Duplicate API handler registration: ${key}`);
            }

            out[key] = {
                process: handler.process as (
                    params: unknown,
                    context: ApiHandlerContext
                ) => Promise<unknown>,
                ...(handler.meta ? { meta: handler.meta } : {}),
            };
        }
    }

    return out;
}