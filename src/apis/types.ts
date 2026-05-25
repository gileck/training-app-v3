import type { z } from 'zod';

export type ApiHandlers = Record<string, {
  process: ((params: unknown, context: ApiHandlerContext) => Promise<unknown>);
}>

/**
 * Same registry shape as `ApiHandlers` but with optional per-entry
 * `meta` for endpoints that opt into the agent tool surface. The
 * runtime shape is identical for non-agent code paths — the `meta`
 * field is just an extra read-only property.
 *
 * Convention: handler files MAY `export const apiMeta: ApiMeta = ...`
 * alongside the handler function. The domain's `server.ts` wires it
 * into the registry entry as `meta`. Default-deny: missing or
 * `agentExposed: false` means the agent can't see the API.
 */
export type ApiHandlersWithMeta = Record<string, {
  process: ((params: unknown, context: ApiHandlerContext) => Promise<unknown>);
  meta?: ApiMeta;
}>

/**
 * Per-API metadata for the agent tool surface.
 *
 * Co-located with the handler so it can't drift from registration.
 * Prefer the `defineApiMeta<TRequest>()` helper below — it adds a
 * compile-time check that the Zod schema infers a type compatible
 * with the handler's request type.
 */
export interface ApiMeta {
  /** One-line description shown to the model in tool docs. Use second
   *  person ("List all todos…", "Create a new todo…") — matches how
   *  the model will use it. */
  description: string;
  /** Zod raw-shape (the object you'd pass to `z.object({ ... })`).
   *  Matches `AgenticTool.inputSchema`. Use `{}` for no-arg endpoints. */
  inputSchema: Record<string, z.ZodTypeAny>;
  /** True iff invoking this API mutates user data. Drives the "Saved"
   *  chip in the agent UI and could gate behind explicit confirmation
   *  in future revisions. Defaults to false if omitted. */
  mutates?: boolean;
  /** Explicit opt-in. Set true to expose this API to the agent. We
   *  default-deny because the registry includes admin/auth flows. */
  agentExposed: boolean;
}

/**
 * Sentinel field added to the inferred type ONLY when the Zod schema
 * doesn't match the handler's request type. Surfaces the mismatch at
 * the `defineApiMeta` call site as a TS error mentioning this field —
 * the message itself is the diagnostic. The field is never present at
 * runtime.
 */
type SchemaMismatch = {
  _SCHEMA_MISMATCH_: "Zod inputSchema infers a type that doesn't assign to the declared TRequest";
};

/**
 * Identity-style helper that *enforces* the Zod input schema matches
 * the handler's request type at compile time.
 *
 * The double-call form lets TypeScript both:
 *   1. accept an explicit `<TRequest>` from the caller, and
 *   2. infer the Zod shape from the meta object literal.
 *
 * Usage:
 *   ```ts
 *   export const apiMeta = defineApiMeta<CreateTodoRequest>()({
 *     description: 'Create a new todo for the current user.',
 *     inputSchema: {
 *       title: z.string().min(1),
 *       dueDate: z.string().optional(),
 *     },
 *     agentExposed: true,
 *     mutates: true,
 *   });
 *   ```
 *
 * If `inputSchema` infers `{ title: string; dueDate?: string }` and the
 * handler declares `CreateTodoRequest = { title: string; dueDate?: string; _id?: string }`,
 * the inferred shape assigns to the declared one — no error.
 *
 * If you forget a field on the schema that the handler requires (e.g.
 * the schema omits `todoId` but `GetTodoRequest` requires it), TS
 * surfaces an error at this call referencing `_SCHEMA_MISMATCH_`.
 *
 * Calling without a generic (`defineApiMeta()`) skips the check.
 */
export function defineApiMeta<TRequest = never>(): <
  Shape extends Record<string, z.ZodTypeAny>,
>(
  meta: {
    description: string;
    inputSchema: Shape;
    agentExposed: boolean;
    mutates?: boolean;
  } & ([TRequest] extends [never]
    ? unknown
    : z.infer<z.ZodObject<Shape>> extends TRequest
    ? unknown
    : SchemaMismatch)
) => ApiMeta {
  // Identity at runtime — the generic + conditional type does the work.
  return (meta) => meta as ApiMeta;
}

export type ErrorResponse = {
  error: string;
};

export interface ApiHandlerContext {
  userId?: string; // Optional: User may not be authenticated
  isAdmin: boolean;
  getCookieValue: (name: string) => string | undefined;
  setCookie: (name: string, value: string, options?: Record<string, unknown>) => void;
  clearCookie: (name: string, options?: Record<string, unknown>) => void;
}
