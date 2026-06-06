---
description: Migrate a child project off the old project-owned in-app agent (apis/project/agent, features/project/agent, collections/project/agentConversations) onto the template-owned agent engine. Run AFTER a template sync brings in src/apis/template/agent, src/client/features/template/agent, and src/server/database/collections/template/agentConversations. Extracts the child's handler path + system prompt + default model into the thin project seams, deletes the old duplicated copies, rewires registration, and fixes the child's chat-UI imports. Idempotent — no-ops if already migrated.
---

# Migrate In-App Agent to Template

The in-app agent's generic plumbing — chat **API**, **hooks/store**, and
conversation **storage** — moved from project-owned folders into the template so
children get fixes for free. Only a thin per-project seam stays project-owned:

| Concern | Old (project, now deleted) | New |
|---|---|---|
| Chat API domain | `src/apis/project/agent/**` | `src/apis/template/agent/**` (synced) |
| Handler path + system prompt | hardcoded in `…/handlers/sendMessage.ts` | **seam** `src/apis/project/agent/runtime.project.ts` (project) |
| Hooks + store | `src/client/features/project/agent/**` | `src/client/features/template/agent/**` (synced) |
| Default model | `…/store.ts` `DEFAULT_MODEL_ID` | **seam** `src/client/utils/project/agentClientConfig.ts` (project) |
| Conversation storage | `src/server/database/collections/project/agentConversations/**` | `…/collections/template/agentConversations/**` (synced) |
| Chat UI | `src/client/routes/project/Agent/**` | unchanged — **still project-owned** |

After a template sync the child has **both** copies → the `agent` API domain
registers twice and `agentConversations` is exported twice. This skill removes
the old copies and rewires the seams so the tree is green again.

**Run conversationally. Each step has a verify gate — do not advance until it
passes.** The only files this skill deletes are the old project copies listed
below; it must NOT touch the new `*/template/agent/**` files (those come from
sync — if they look wrong, fix via `/sync-template`, not here).

---

## Step 0 — Preflight (gating)

1. **Child project.** If `package.json` `name` is `app-template-ai`, STOP — this
   is the template itself; there is nothing to migrate.

2. **New template code has synced in.** Confirm ALL exist:
   - `src/apis/template/agent/server.ts`
   - `src/client/features/template/agent/store.ts`
   - `src/server/database/collections/template/agentConversations/index.ts`
   - `src/apis/apis.template.ts` imports `./template/agent/server`
   - `src/server/database/collections/index.template.ts` exports `agentConversations` from `./template/agentConversations`

   If any are missing → run `/sync-template` first, then return.

3. **Old project code still present?** Check whether the child still has the old
   copies:
   - `src/apis/project/agent/server.ts` (old API) — distinguish from the new
     **seam** `src/apis/project/agent/runtime.project.ts`
   - `src/client/features/project/agent/store.ts`
   - `src/server/database/collections/project/agentConversations/`

   If **none** of these exist and the seams (`runtime.project.ts`,
   `agentClientConfig.ts`) already exist → **already migrated, no-op.** Stop and
   say so.

4. **Clean tree.** Confirm the working tree is committed/clean (this skill
   deletes and rewrites several files). If `yarn checks` is currently red purely
   from the duplicate-agent collisions, that's expected — note it and continue.

Gate: new code present, old code present, tree clean. Then continue.

---

## Step 1 — Capture the child's current customizations

Before deleting anything, read the child's existing values so the new seams
preserve them. Extract:

1. **Handler path** — from old `src/apis/project/agent/handlers/sendMessage.ts`,
   the `HANDLER_PATH` constant (e.g. `src/server/project/doctor-agent/handler`).
   If the child already migrated `sendMessage` to read a seam, take it from there.

2. **System prompt** — the `DEFAULT_SYSTEM_PROMPT` constant in the same file (or
   the child's `systemPrompt.ts` if they extracted it).

3. **Default model** — `DEFAULT_MODEL_ID` in old
   `src/client/features/project/agent/store.ts` (e.g. `claude-code-sonnet`).

Echo the three captured values back to the user and confirm before proceeding.
If the old files were already deleted, ask the user for these (or use the
template defaults: handler `src/server/project/demo-agent/handler`, the demo
prompt, model `claude-code-sonnet`).

Gate: three values captured and confirmed.

---

## Step 2 — Create the project seams

Write the two project-owned seam files with the captured values.

`src/apis/project/agent/runtime.project.ts`:

```ts
/**
 * Project-owned agent runtime config (NOT synced from template).
 * Points the template-owned agent/sendMessage endpoint at THIS project's agent.
 */
export const agentRuntime = {
    handlerPath: '<captured HANDLER_PATH>',
    systemPrompt: `<captured DEFAULT_SYSTEM_PROMPT>`,
};
```

`src/client/utils/project/agentClientConfig.ts`:

```ts
/**
 * Project-owned agent client config (NOT synced from template).
 * Lives under client/utils/project so the template-owned agent store can import
 * it without crossing the template→project module boundary.
 */
export const agentClientConfig = {
    defaultModelId: '<captured DEFAULT_MODEL_ID>',
};
```

Gate: both seam files exist with the child's values.

---

## Step 3 — Delete the old project copies

Delete (these now live in the template):

```
git rm -r src/client/features/project/agent
git rm -r src/server/database/collections/project/agentConversations
# API: delete everything EXCEPT the new runtime.project.ts seam
git rm -r src/apis/project/agent/handlers
git rm src/apis/project/agent/{client,index,server,types}.ts
git rm src/apis/project/agent/systemPrompt.ts   # only if the child created it
```

Leave `src/apis/project/agent/runtime.project.ts` in place. After this,
`src/apis/project/agent/` should contain **only** `runtime.project.ts`.

Gate: old copies gone; the lone remaining project file is the runtime seam.

---

## Step 4 — Rewire registration (project-owned index files)

These project-owned files still register the old copies — remove those lines
(the template's `*.template.ts` versions now register the agent):

1. **`src/apis/apis.project.ts`** — remove the
   `import { agentApiHandlers } from "./project/agent/server";` line and the
   `agentApiHandlers` entry from `mergeApiHandlers(...)`.

2. **`src/server/database/collections/index.project.ts`** — remove the
   `export * as agentConversations from './project/agentConversations';` line.

Gate: neither project index still references the old agent paths.

---

## Step 5 — Fix the child's chat-UI imports

`src/client/routes/project/Agent/**` is project-owned (the child's copy) and
still imports the old module paths. Update every occurrence:

- `@/apis/project/agent/client`  → `@/apis/template/agent/client`
- `@/apis/project/agent/types`   → `@/apis/template/agent/types`
- `@/client/features/project/agent` → `@/client/features/template/agent`

(Do NOT rewrite `@/apis/project/agent/runtime.project` — that's the seam.)
Grep to confirm nothing project-owned still points at the old API/feature paths:

```
grep -rn "apis/project/agent/\(client\|types\)\|features/project/agent\|collections/project/agentConversations" src
```

The only hit should be the seam import of `runtime.project`.

Gate: grep clean except the seam.

---

## Step 6 — Verify

1. `yarn checks` — must be fully green (the duplicate-domain / duplicate-export
   collisions are resolved; tsc, ESLint boundary rule, circular, knip all pass).
2. Smoke-test if the daemon is available: open `/agent`, send a message, confirm
   the assistant turn streams and a tool fires (same as `build-app-agent` Phase 6).
3. Offer to commit (don't commit unprompted). Suggested message:
   `refactor(agent): migrate in-app agent onto template-owned engine`.

Gate: `yarn checks` green and (if testable) a real turn works.

---

## Notes

- **Idempotent.** Re-running after a successful migration hits Step 0's no-op
  branch (old copies gone, seams present).
- **The chat UI stays yours.** Only its import paths change; your branding,
  welcome copy, and message rendering are untouched.
- **Future agent fixes** (streaming, polling, attachments, stuck-pending
  recovery) now arrive via `/sync-template` with no further edits — you only own
  the two seam files, the agent module under `src/server/project/<agent>/`, and
  the chat UI.
