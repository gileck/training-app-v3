---
title: Agent API Tools (auto-expose project APIs to the agent)
description: How project APIs become agent tools. Use this when wiring an existing API endpoint into the AI agent's tool surface so the model can call it.
summary: >-
  Co-locate an `apiMeta` export next to an API handler, then wire it into the
  domain's server.ts as the `meta` field on the registry entry.
  `buildAgentToolsFromApis(apiHandlers)` walks the registry and emits one
  AgenticTool per opted-in endpoint. Default-deny, isAdmin always false,
  Zod-validated, error envelopes normalized.
priority: 4
key_points:
  - "Two-line opt-in per endpoint — `export const apiMeta = {...}` in the handler file, plus a `meta` entry in the domain's server.ts"
  - "Default-deny — `agentExposed: true` is required; admin endpoints are unreachable two ways over (no opt-in plus synthesized `isAdmin: false` context)"
  - "Tool name is derived from API name — `todos/getTodos` becomes `api__todos_getTodos`; collisions throw at build time"
  - "`mutates: true` drives the UI's Saved chip and can gate behind confirmation in future"
  - "Agent runs with `userId` from its tool context; cross-tenant safety enforced at the DB layer (all queries filter by userId)"
  - "Both Claude Code and Codex adapters see the same tool list — built once per process from the same apiHandlers registry"
---

# Agent API Tools

Project APIs (the same ones the React app uses via `apiClient.call(...)`) can be auto-exposed to the AI agent as native tools, with type-safe Zod input validation, mutation tracking, and `userId`-scoped invocation. No bespoke tool wrappers required — just opt the endpoint in.

## TL;DR

To expose `foo/bar` to the agent, edit `src/apis/project/foo/handlers/bar.ts`:

```ts
import { defineApiMeta } from '@/apis/types';
import { z } from 'zod';
import type { BarRequest } from '../types';

// Prefer `defineApiMeta<TRequest>()` over a bare `ApiMeta` annotation —
// it verifies at compile time that the Zod inputSchema matches the
// handler's request type. Drop the generic and you skip the check.
export const apiMeta = defineApiMeta<BarRequest>()({
    description: "Short, second-person description of what bar does.",
    inputSchema: {
        someParam: z.string().describe('What this means to the agent.'),
    },
    agentExposed: true,
    mutates: false, // true if this writes to the DB
});

export const bar = async (req: BarRequest, ctx) => { /* unchanged */ };
```

If you forget a field on the schema that `BarRequest` requires (or vice versa), TS errors at the `defineApiMeta` call referencing `_SCHEMA_MISMATCH_` — the sentinel field name *is* the diagnostic.

Then wire it into `src/apis/project/foo/server.ts`:

```ts
import { bar, apiMeta as barMeta } from './handlers/bar';

export const fooApiHandlers = {
    [API_BAR]: { process: bar, meta: barMeta },
    // …
};
```

That's it. The next time the agent's RPC daemon reloads (`yarn daemon:dev` does this on file change), the model sees a new tool named `api__foo_bar` with the description and schema you wrote. Start a new conversation to pick up the new tool (existing conversations resume the prior Claude session and won't see new tools — see "Session resume gotcha" below).

## Architecture

### Pieces

- **`ApiMeta`** (`src/apis/types.ts`) — per-handler metadata interface: `{ description, inputSchema, agentExposed, mutates? }`. Optional; co-located with the handler file as `export const apiMeta: ApiMeta`.

- **`ApiHandlersWithMeta`** (`src/apis/types.ts`) — registry shape with optional `meta` per entry. The non-meta path is unchanged, so template handlers and any project endpoints that haven't opted in keep working without modification.

- **`mergeApiHandlers`** (`src/apis/registry.ts`) — preserves `meta` through the registry merge if present, drops it otherwise.

- **`buildAgentToolsFromApis`** (`src/server/template/agentic/apiTools.ts`) — walks the merged registry, filters by `meta.agentExposed === true`, emits one `AgenticTool` per opted-in endpoint. Used in the project's agent handler.

- **Demo agent** (`src/server/project/demo-agent/handler.ts` and `…/adapters/codex-mcp-server.ts`) — calls `buildAgentToolsFromApis({ handlers: apiHandlers })` and concats the result with its own hand-rolled tools.

### Flow at runtime

1. Project's API handler file exports `apiMeta` alongside the handler function.
2. Domain's `server.ts` wires `meta:` into each registry entry.
3. `apis/apis.ts` merges template + project registries into a single `apiHandlers` object.
4. The demo-agent handler (`src/server/project/demo-agent/handler.ts`) imports `apiHandlers` and calls `buildAgentToolsFromApis(...)` at module load.
5. The agent's RPC handler is invoked per turn with `tools: [...DEMO_AGENT_TOOLS, ...apiTools]`.
6. Both adapters (Claude Code via in-process MCP, Codex via stdio subprocess) see the same tool list — the Codex subprocess script (`codex-mcp-server.ts`) calls the same helper.
7. When the model invokes a tool, `buildAgentToolsFromApis`'s synthesized handler:
   - Re-validates `args` against the Zod schema (defensive — engine already validated, but it cross-cast as `never`).
   - Synthesizes an `ApiHandlerContext` from the agent's `ctx.userId` (with `isAdmin: false`, inert cookie ops).
   - Invokes `entry.process(args, ctx)`.
   - Normalizes the result: `{ error: '…' }` envelopes → `{ ok: false, error }`; thrown exceptions → `{ ok: false, error: e.message }`; everything else → `{ ok: true, data: result }`.

## Security model

Default-deny, multiple defenses:

1. **`agentExposed: true` is mandatory.** Missing `meta` or `agentExposed: false` → the API is not in the tool list. The registry contains every endpoint including `admin/*`; opting in must be explicit.

2. **`isAdmin: false` is hardcoded.** The synthesized `ApiHandlerContext` never reports admin, so even if an `admin/*` handler were accidentally opted in, it would refuse at its own `isAdmin` check.

3. **No cookies, no HTTP context.** Cookie ops are inert no-ops. Auth/RPC-gate flows that depend on cookies intentionally cannot be invoked via the agent.

4. **`userId` is the only authority.** The agent inherits the `userId` of the conversation owner from `ctx.userId`. Every project DB query filters by `userId`, so even if the model fabricates a `todoId` for another user's row, the DB returns null.

5. **Zod validation re-runs at the boundary.** The engine validates `args` before dispatch, and `buildAgentToolsFromApis` parses again before invoking the handler. Schema-violating input never reaches the handler.

## Naming

API name `'todos/getTodos'` → tool name `'api__todos_getTodos'`. The transform is `'api__' + apiName.replace(/[^a-zA-Z0-9_]/g, '_')`. Two distinct API names that collapse to the same tool name (e.g. `'a/b'` and `'a-b'`) throw at `buildAgentToolsFromApis` call time — you'll see this at daemon startup if it ever happens.

## Mutation flag

`mutates: true` on the meta:

- Sets `didMutate: (_args, result) => result.ok` on the generated tool. Successful calls drive the UI's "Saved" chip on the assistant message.
- Lets future revisions add things like per-mutation confirmation modes, dry-run, or per-agent allow/deny without rewriting individual tools.

For now, `mutates: true` does not by itself block invocation — opting in still means opting in. Use `agentExposed: false` if you don't want the agent to call it at all.

## Tool count

Currently every opted-in API becomes a discrete tool with its own schema, so the model sees full type info upfront — no extra discovery hop, no hallucinated API names. If the surface grows past ~30 endpoints, switch to a `list_apis` + `get_api_schema` + `call_api` discovery pattern. The helper's `filter` parameter is designed for this (and for per-conversation scoping).

## Session resume gotcha

Claude Code's SDK caches the tool list when a session is created. Once a conversation has a stored `sessionId`, the next turn resumes that session — and the model's working memory still reports the tools it had at session start, even if a new tool was added since.

If you opt in a new API and the agent claims it can't see the tool, **start a new conversation**. Future improvement: add a "Reset session" action in the thread 3-dot menu that clears `conversation.sessionId` so the next turn starts a fresh Claude session.

## Adding a new API to the agent — step by step

1. **Pick the handler.** Anything under `src/apis/project/<domain>/handlers/*.ts`. The handler must accept its request type plus `ApiHandlerContext` and return `{ data?, error? }`.

2. **Author the Zod schema.** Match the request shape, but be deliberate about what the agent should see:
   - Omit fields the model has no business setting (e.g. `_id` for client-side idempotency).
   - Use `.describe(...)` on every field — this is documentation the model reads.
   - Use `.optional()` for fields the model can omit.
   - Use `.nullable()` if `null` has special meaning (e.g. clearing a date).

3. **Co-locate `apiMeta`.** In the handler file, alongside the handler export. Use the typed helper so the Zod schema is verified against the handler's request type:
   ```ts
   import { defineApiMeta } from '@/apis/types';
   import { z } from 'zod';
   import type { MyRequest } from '../types';

   export const apiMeta = defineApiMeta<MyRequest>()({
       description: '…',
       inputSchema: { /* … */ },
       agentExposed: true,
       mutates: false, // or true
   });
   ```
   The bare `export const apiMeta: ApiMeta = { ... }` form still works (and skips the type check) if you don't have a request-type interface to reference.

4. **Wire `meta:` into the registry.** In the domain's `server.ts`:
   ```ts
   import { myHandler, apiMeta as myHandlerMeta } from './handlers/myHandler';

   export const myDomainApiHandlers = {
       [API_MY_HANDLER]: { process: myHandler, meta: myHandlerMeta },
       // …
   };
   ```

5. **Restart the daemon** (or rely on `yarn daemon:dev` to hot-reload). Start a new conversation, ask the agent to use the new capability.

## Convention checklist for descriptions

- One sentence. Second person. Active voice. ("List the current user's todos." / "Mark a todo as done.")
- Describe behaviour, not implementation. ("Returns the created todo." not "Inserts a row into Mongo.")
- For mutations, name the side effect. ("Send a Telegram notification to the current user." not "Notify a user.")
- For ID parameters, point at the source. ("`todoId` — as returned by `list_todos` in the `_id` field.")

## Related

- [agentic engine commit notes][agentic-commit] — the underlying `AgenticTool` / `createAgentHandler` surface.
- `src/server/project/demo-agent/` — reference project agent that uses this pattern.
- `docs/template/api-endpoint-format.md` — how project APIs are structured.

[agentic-commit]: ../../src/server/template/agentic/index.ts
