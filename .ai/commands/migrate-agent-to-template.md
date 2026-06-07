---
description: Clean up a child project that has the OLD project-owned in-app agent (src/apis/project/agent, src/client/features/project/agent, src/server/database/collections/project/agentConversations) after a template sync brought in the new template-owned agent engine. Removes the duplicated old copies (which collide — double-registered 'agent' API domain + double agentConversations export), ports the child's custom handler path / system prompt / default model into the synced override seams, and adds those seams to projectOverrides. Idempotent. Children that never had the old project agent need NOTHING — a plain /sync-template already works.
---

# Migrate In-App Agent to Template

The in-app agent's generic plumbing — chat **API**, **hooks/store**, and
conversation **storage** — moved from project-owned folders into the template so
children get fixes via `/sync-template`. The per-project knobs now live in two
**synced override seams** that ship template defaults:

| Concern | Old (project, now removed) | New |
|---|---|---|
| Chat API domain | `src/apis/project/agent/**` | `src/apis/template/agent/**` (synced) |
| Handler path + system prompt | hardcoded in `…/handlers/sendMessage.ts` | **seam** `src/apis/template/agent/runtime.ts` (synced default + `projectOverride`) |
| Hooks + store | `src/client/features/project/agent/**` | `src/client/features/template/agent/**` (synced) |
| Default model | `…/store.ts` `DEFAULT_MODEL_ID` | **seam** `src/client/utils/agentClientConfig.ts` (synced default + `projectOverride`) |
| Conversation storage | `src/server/database/collections/project/agentConversations/**` | `…/collections/template/agentConversations/**` (synced) |
| Chat UI | `src/client/routes/project/Agent/**` | unchanged — **still project-owned** |

**You only need this skill if the child has the OLD project-owned agent.** After
a sync, such a child has BOTH copies → the `agent` API domain registers twice and
`agentConversations` exports twice (tsc + registry errors). A child that never had
the project agent gets everything from sync (including the seam defaults) and needs
no migration.

**Run conversationally. Each step has a verify gate.** The only files this skill
deletes are the old project copies listed below; never touch the new
`*/template/agent/**` files (those come from sync).

---

## Step 0 — Preflight (gating)

1. **Child project.** If `package.json` `name` is `app-template-ai`, STOP — this
   is the template itself.

2. **New template code synced in.** Confirm ALL exist (else run `/sync-template`
   first):
   - `src/apis/template/agent/server.ts` and `src/apis/template/agent/runtime.ts`
   - `src/client/features/template/agent/store.ts`
   - `src/client/utils/agentClientConfig.ts`
   - `src/server/database/collections/template/agentConversations/index.ts`

3. **Old project copies present?** Check for:
   - `src/apis/project/agent/server.ts`
   - `src/client/features/project/agent/store.ts`
   - `src/server/database/collections/project/agentConversations/`

   If **none** exist → **nothing to migrate** (the synced seams already work).
   Stop and say so.

4. **Clean tree.** Commit/stash first. If `yarn checks` is red purely from the
   duplicate-agent collisions, that's expected — note it and continue.

Gate: new code present, old copies present, tree clean. Then continue.

---

## Step 1 — Capture the child's customizations

Read these from the OLD files before deleting them:

1. **Handler path** — `HANDLER_PATH` in old
   `src/apis/project/agent/handlers/sendMessage.ts`
   (e.g. `src/server/project/doctor-agent/handler`).
2. **System prompt** — `DEFAULT_SYSTEM_PROMPT` in the same file (or the child's
   `systemPrompt.ts`).
3. **Default model** — `DEFAULT_MODEL_ID` in old
   `src/client/features/project/agent/store.ts`.

Echo the three values back and confirm.

Gate: three values captured.

---

## Step 2 — Port the values into the synced seams

Edit the seams that arrived from sync (don't recreate the old files):

1. `src/apis/template/agent/runtime.ts` — set `agentRuntime.handlerPath` and
   `agentRuntime.systemPrompt` to the captured values.
2. `src/client/utils/agentClientConfig.ts` — set `defaultModelId` to the captured
   model.

Then **protect the seams you actually changed** — add each *edited* file to
`projectOverrides` in `.template-sync.json`, or the next sync reverts it to the
template default. **Override only what you changed:** listing an unchanged file
freezes it and silently stops it receiving future template updates (and can
re-break it if the template later changes its shape).

```jsonc
// .template-sync.json → projectOverrides
"src/apis/template/agent/runtime.ts",          // you ported handler path + prompt → override
"src/client/utils/agentClientConfig.ts"        // include ONLY if you changed defaultModelId
```

`runtime.ts` is essentially always changed (handler path differs), so it goes in.
Add `agentClientConfig.ts` only if the captured model differed from the template
default; otherwise leave it out and re-add it the day you change the model.

Gate: every seam you edited is listed in `projectOverrides`; unchanged seams are
left out.

---

## Step 3 — Delete the old project copies

```
git rm -r src/apis/project/agent
git rm -r src/client/features/project/agent
git rm -r src/server/database/collections/project/agentConversations
```

(There is no project file to keep — the seams now live under template/ + utils.)

Gate: all three old directories gone.

---

## Step 4 — Rewire the project index files

These project-owned files still register the old copies — remove those lines (the
synced `*.template.ts` versions now register the agent):

1. `src/apis/apis.project.ts` — remove the
   `import { agentApiHandlers } from "./project/agent/server";` line and its entry
   in `mergeApiHandlers(...)`.
2. `src/server/database/collections/index.project.ts` — remove
   `export * as agentConversations from './project/agentConversations';`.

Gate: neither project index references the old agent paths.

---

## Step 5 — Fix the child's chat-UI imports

`src/client/routes/project/Agent/**` is the child's own copy and still imports the
old module paths. Update every occurrence:

- `@/apis/project/agent/client`  → `@/apis/template/agent/client`
- `@/apis/project/agent/types`   → `@/apis/template/agent/types`
- `@/client/features/project/agent` → `@/client/features/template/agent`

Confirm nothing project-owned still points at the old paths:

```
grep -rn "apis/project/agent\|features/project/agent\|collections/project/agentConversations" src
```

Should return nothing.

Gate: grep clean.

---

## Step 6 — Verify

1. `yarn checks` — fully green (collisions resolved; tsc, ESLint boundary rule,
   circular, knip all pass).
2. Smoke-test if the daemon is available: open `/agent`, send a message, confirm
   the assistant turn streams and a tool fires.
3. Offer to commit (don't commit unprompted). Suggested message:
   `refactor(agent): migrate in-app agent onto template-owned engine`.

Gate: `yarn checks` green and (if testable) a real turn works.

---

## Notes

- **Idempotent.** Re-running after success hits Step 0's no-op branch (old copies
  gone).
- **The chat UI stays yours.** Only its import paths change.
- **Override seams ship synced defaults.** That's why a fresh child needs no
  migration — but it's also why a customizing child MUST list **each seam it
  edited** in `projectOverrides`, or the next sync reverts it to the demo agent.
  Don't override seams you didn't change — that just freezes them out of future
  template updates.
- **Future agent fixes** (streaming, polling, attachments, stuck-pending recovery)
  arrive via `/sync-template`. You own only: the two seams, your agent module under
  `src/server/project/<agent>/`, and the chat UI.
