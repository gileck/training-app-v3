import type { ApiHandlerContext, ApiHandlers } from "./types";

/**
 * Helper for building the API registry with minimal boilerplate.
 *
 * Domain modules can export a simple object:
 *   { [API_NAME]: { process: someHandler } }
 *
 * The registry requires a generic `(unknown, context)` signature, but domain handlers
 * naturally use strongly-typed payloads. We centralize the necessary cast here so
 * `src/apis/apis.ts` stays clean.
 */
export type LooseApiHandlers = Record<string, { process: unknown }>;

export function mergeApiHandlers(...sources: LooseApiHandlers[]): ApiHandlers {
    const out: ApiHandlers = {};

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
            };
        }
    }

    return out;
}