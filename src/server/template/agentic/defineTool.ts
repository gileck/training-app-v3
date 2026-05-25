/**
 * Helpers for defining typed `AgenticTool` entries.
 *
 * These are zero-runtime identity functions — the only purpose is to
 * help TypeScript infer the Zod input schema from the call site so the
 * `handler` receives properly-typed args without manual annotation.
 *
 * Two flavours:
 *
 * 1. `defineTool({...})` — ad-hoc, requires explicit TData generic at
 *    the call site if your handler reads from `ctx.data`.
 *
 * 2. `createToolBuilder<TData>()` — preferred for projects with a
 *    single per-turn data context. Instantiate once at the top of
 *    your tools file; every tool gets `ctx.data` typed automatically.
 *
 * Example:
 *
 *   const tool = createToolBuilder<FitnessDataContext>();
 *
 *   export const FITNESS_TOOLS = [
 *     tool({
 *       name: 'list_workouts',
 *       description: 'List recent workouts for the user.',
 *       inputSchema: { since: z.string().optional(), limit: z.number().optional() },
 *       handler: async (args, ctx) => {
 *         // args is { since?: string; limit?: number }
 *         // ctx.data is FitnessDataContext
 *         const workouts = await ctx.data.findWorkouts(args);
 *         return { ok: true, data: workouts };
 *       },
 *       didMutate: () => false,  // optional; defaults to false
 *     }),
 *   ];
 */

import type { AgenticTool, ZodRawShape } from './types';

/** Identity helper. Use when you'd otherwise reach for
 *  `... satisfies AgenticTool<...>`. */
export function defineTool<Shape extends ZodRawShape, TData = unknown>(
    tool: AgenticTool<Shape, TData>
): AgenticTool<Shape, TData> {
    return tool;
}

/** Bind TData once and return a project-scoped tool builder. Recommend
 *  this over the bare `defineTool` for any project with a shared per-
 *  turn data context (which is most of them). */
export function createToolBuilder<TData>() {
    return function tool<Shape extends ZodRawShape>(
        spec: AgenticTool<Shape, TData>
    ): AgenticTool<Shape, TData> {
        return spec;
    };
}
