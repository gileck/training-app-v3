---
number: 46
title: "Upstream MCP/SDK access pattern into template"
priority: Medium
size: M
complexity: Medium
status: TODO
dateAdded: 2026-04-19
---

# Task 46: Upstream MCP/SDK access pattern into template

**Summary:** Move the generic parts of the training-app MCP integration (bearer-token auth, admin/users/list, SDK transport/errors/validation harness, MCP server scaffold) into the template so every child project gets programmatic agent access for free, without copy-paste and without template-sync fights.

## Motivation

- We built a working "agents can act as any user via ADMIN_API_TOKEN bearer + X-On-Behalf-Of" pattern in `training-app-v3` (SDK at `packages/training-app-sdk`, MCP at `packages/training-app-mcp`, plus server auth changes).
- The last template sync nuked the server-side pieces because they lived on template-owned paths. Recovering required re-applying files and adding every touched path to `projectOverrides`. That's a one-way ratchet — every new child project needs the same scaffolding.
- The transport, auth, error types, validation helpers, tool dispatch, and `admin/users/list` are **100% generic**. Only the domain tools (plans, exercises, workouts) are project-specific.
- Upstream the generic half; the split is clean.

## Scope

### In scope (move into template)

1. **Server-side auth path** — `src/apis/getUserContext.ts`:
   - Accept `Authorization: Bearer <ADMIN_API_TOKEN>` + `X-On-Behalf-Of: <userId>` **before** the dev `LOCAL_USER_ID` shortcut.
   - `crypto.timingSafeEqual` token comparison.
   - Sets `authDebug.tokenAuth = true` when bearer-authenticated.

2. **`AuthDebugInfo.tokenAuth?: boolean`** — `src/apis/template/auth/types.ts`.

3. **Admin gate** — `src/apis/processApiCall.ts`:
   - `admin/*` endpoints require `isAdmin` **OR** `authDebug.tokenAuth === true`.

4. **`admin/users/list` endpoint** — `src/apis/template/admin-users/` (new template domain):
   - `index.ts`, `types.ts`, `handlers/listUsers.ts`, `server.ts`.
   - Returns `{ users: [{ id, username, email, createdAt, isAdmin }] }`.
   - Requires `listAllUsers()` helper in `src/server/database/collections/template/users/users.ts` (already exists in some child projects).
   - Registered in `apis.template.ts`.

5. **SDK harness** — `packages/<name>/src/` template scaffold:
   - `http.ts` — `callApi`, `CacheResult`, `ClientOptions`, error throwing, per-request timeout.
   - `errors.ts` — `TrainingAppError` base + `TrainingAppValidationError` / `ApiError` / `NetworkError` / `ResponseError`. (Rename `TrainingApp*` → generic `AppError*` or derive from project name at scaffold time.)
   - `validation.ts` — `assertNonEmptyString`, `assertPositiveNumber`, `assertOneOf`, etc.
   - `admin.ts` — `client.admin.users.list()` thin wrapper.
   - `index.ts` — `createClient({ baseUrl, adminToken, userId, timeoutMs })` factory with `asUser(userId)` scoper + `call<T>(apiName, params)` escape hatch. Domain slots filled in by child project.
   - `package.json`, `tsconfig.json` (ESM, Node 18+).

6. **MCP harness** — `packages/<name>-mcp/src/` template scaffold:
   - `server.ts` — stdio MCP server, registers tool list, dispatcher that strips top-level `userId` and calls `client.asUser(userId)` automatically, structured error formatting.
   - `tools.ts` skeleton — exports `TOOLS: ToolDef[]`, shared schema builders (`str`, `num`, `arr`), and the generic `list_users` + `call_api` tools.
   - `package.json` with `@modelcontextprotocol/sdk` dep + `file:` dep on the SDK package.
   - `tsconfig.json`.
   - `scripts/sync-skill.sh` — copies the canonical skill to a consumer.

7. **Skill template** — `packages/<name>-mcp/skills/use-<app>/SKILL.md` with:
   - Frontmatter that works in both Claude Code (`description`, `priority`, `key_points`) and Agent SDK container (`allowed-tools: mcp__<name>__*`) contexts.
   - Sections for auth model, `userId` override, `list_users` flow, error taxonomy.
   - Child project only fills in domain tool catalog + worked examples.

8. **Documentation** — `docs/template/mcp-sdk-access.md`:
   - How to set `ADMIN_API_TOKEN` in Vercel env.
   - How to add a new typed domain to the SDK/MCP.
   - How to register the MCP in `.mcp.json` locally and in consumers (NanoClaw-style containers).
   - Security caveats (token = god-mode, rotate on leak, not in shared repos without thought).

### Out of scope (stays project-specific)

- Domain wrappers: `plans.ts`, `exercises.ts`, `workouts.ts`, etc. — each project adds its own.
- Domain tool entries in `TOOLS` array — each project adds its own.
- Staleness/version endpoints — those are local-first-pattern-specific, not universal.
- The prod-deploy + `.mcp.json` + env-var setup — still per-project.

## Design decisions

- **One template pattern, two packages per project.** Child project creates `packages/<name>-sdk/` and `packages/<name>-mcp/`. Template provides the scaffold generator (e.g. a `yarn init:mcp <name>` script) or clear docs for manual setup.

- **Error class naming.** Currently `TrainingAppApiError`, etc. For the template, either:
  - (a) Keep the name generic: `AppApiError` / `SdkApiError` / `ClientApiError`. Exported from template package.
  - (b) Have the scaffold generator substitute the project name at creation time.
  I'd prefer (a) — simpler, reusable.

- **Bundle approach.** The MCP server ships as a single esbuild-bundled file so consumers (NanoClaw containers, etc.) don't need to install dependencies. The bundle step is:
  ```
  npx esbuild src/server.ts --bundle --platform=node --format=esm --target=node20 \
    --outfile=dist/server.bundle.mjs
  ```
  Document this in the scaffold.

- **`admin/users/list` gating semantics.** The gate change (`isAdmin || tokenAuth`) is a security boundary shift — the template should document clearly that ANY holder of `ADMIN_API_TOKEN` becomes effectively admin for `admin/*` endpoints. That's already how the token works semantically (it acts on behalf of any user), but making it explicit in the gate is new.

## Implementation notes

- The server-side changes (#1–4) are small and self-contained. These should land as a single PR to the template.
- The SDK/MCP harness (#5–7) is best shipped as a `scripts/template/init-mcp.ts` that:
  - Takes a name (e.g. `training-app`)
  - Creates `packages/<name>-sdk/` and `packages/<name>-mcp/` with the boilerplate
  - Adds them to root `tsconfig.json` exclude
  - Adds `packages/**/node_modules` + `packages/**/dist` to `.gitignore`
  - Seeds one dummy domain (e.g. `ping`) so the consumer sees the pattern
- Alternatively: ship the scaffolding as copy-me example directories under `docs/template/examples/mcp-sdk/` and document the manual steps.

## Acceptance criteria

- [ ] Template has bearer-auth + tokenAuth admin gate baked into `getUserContext.ts` and `processApiCall.ts`
- [ ] Template has `admin/users/list` endpoint under `src/apis/template/admin-users/`
- [ ] Template has `listAllUsers()` in users collection
- [ ] Template has `tokenAuth?: boolean` on `AuthDebugInfo`
- [ ] Template provides SDK+MCP scaffold (either generator script or example dir)
- [ ] Template provides skill markdown template with both frontmatter formats
- [ ] Docs page explains setup end to end
- [ ] Existing child project (`training-app-v3`) can drop its `projectOverrides` entries for `getUserContext.ts`, `processApiCall.ts`, `apis.template.ts`, `admin-users/`, `users.ts` once they come from the template directly
- [ ] New child project can run `yarn init:mcp my-app` (or equivalent) and get a working minimal MCP server in <5 minutes

## References

- `training-app-v3` commits that built the pattern:
  - `d00f086` feat: add ADMIN_API_TOKEN bearer auth + SDK/MCP for agent access
  - `5a9eab1` feat: per-call userId override + admin/users/list for name resolution
  - `3cf3e67` refactor: one-timestamp plan-data staleness via trainingPlans.touchPlan *(plan-data-specific, not part of this task)*
- `training-app-v3/packages/training-app-sdk/` — reference implementation of the SDK harness
- `training-app-v3/packages/training-app-mcp/` — reference implementation of the MCP server
- `training-app-v3/packages/training-app-mcp/skills/use-training-app-v3/SKILL.md` — reference skill
- `training-app-v3/packages/training-app-mcp/skills/README.md` — reference dev→prod flow documentation
- `NanoClaw` integration: `nanoclaw/docs/TRAINING-APP-INTEGRATION.md` covers how a downstream consumer wires the MCP bundle into an agent container
