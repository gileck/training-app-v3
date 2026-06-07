---
description: Migrate a child project's in-app agent onto the template's CONVENTION model after a template sync. Brings any older layout to the end-state where the agent is 100% project-owned at the fixed path src/server/project/agent/ (handler owns its system prompt) and the template's agent/sendMessage enqueues that path by convention — no synced override seam, no projectOverrides for the agent. Handles two legacy states: (A) the very old project-owned API/store/storage (src/apis/project/agent, src/client/features/project/agent, src/server/database/collections/project/agentConversations) which collides with the synced template copies; and (B) the interim runtime.ts override seam (src/apis/template/agent/runtime.ts) + a descriptively-named agent folder. Idempotent. A child already on the convention model needs nothing.
---

# Migrate In-App Agent to the Convention Model

End-state (what this produces):

| Concern | Where it lives | Owner |
|---|---|---|
| Chat API, hooks/store, storage, engine | `src/apis/template/agent/**`, `src/client/features/template/agent/**`, `…/collections/template/agentConversations/**`, `src/server/template/agentic/**` | template (synced) |
| The agent (handler + **system prompt** + tools + Codex bootstrap) | **`src/server/project/agent/**`** (fixed convention path) | project (not synced) |
| Default model | `src/client/utils/agentClientConfig.ts` | synced seam — `projectOverride` only if changed |
| Chat UI | `src/client/routes/project/Agent/**` | project |

Key facts:
- `agent/sendMessage` enqueues the **constant** handler path `src/server/project/agent/handler` — there is **no** `runtime.ts` and **no** agent entry in `projectOverrides`.
- The agent's identity is `SYSTEM_PROMPT` passed into `createAgentHandler({ systemPrompt })` in the handler.
- The Codex MCP bootstrap default is the convention path too, so no `codexMcpServerPath` override is needed.

**Run conversationally. Each step has a verify gate.** Skip any step whose
"from" state doesn't apply to this child.

---

## Step 0 — Detect the child's current state

```bash
# A: very old project-owned agent (pre-template-agent)
ls src/apis/project/agent/server.ts src/client/features/project/agent src/server/database/collections/project/agentConversations 2>/dev/null
# B: interim runtime.ts seam
ls src/apis/template/agent/runtime.ts 2>/dev/null
# current agent folder (convention vs descriptive)
ls -d src/server/project/*agent* src/server/project/agent 2>/dev/null
node -e "console.log(require('./.template-sync.json').projectOverrides)"
```

- If `app-template-ai` itself → STOP (it's the template).
- If the agent already lives at `src/server/project/agent/`, there's no `runtime.ts`, and no agent entry in `projectOverrides` → **already on the convention model, no-op.** Stop.
- Otherwise classify as **A** (has old project-owned API/store/storage) and/or **B** (has `runtime.ts`), and proceed with the steps that apply. Commit/stash first.

---

## Step 1 (state A only) — remove the old duplicated project copies

These now live in the template and collide with the synced copies (double
`agent` API domain, double `agentConversations` export):

```bash
git rm -r src/apis/project/agent src/client/features/project/agent \
          src/server/database/collections/project/agentConversations
```

Then rewire the project index files:
- `src/apis/apis.project.ts` — remove the `agentApiHandlers` import + its `mergeApiHandlers(...)` entry.
- `src/server/database/collections/index.project.ts` — remove the `agentConversations` export line.

And fix the chat-UI imports in `src/client/routes/project/Agent/**`:
`@/apis/project/agent/{client,types}` → `@/apis/template/agent/{client,types}`, and
`@/client/features/project/agent` → `@/client/features/template/agent`.

Gate: `grep -rn "apis/project/agent\|features/project/agent\|collections/project/agentConversations" src` returns nothing.

---

## Step 2 — Land the agent at the convention path `src/server/project/agent/`

Find the child's current agent folder (e.g. `src/server/project/training-coach/`,
`src/server/project/nutrition-agent/`, or the synced default may have delivered
nothing under `project/` for an old child).

- If it's at a descriptive path → **rename it to the convention path** (internal
  relative imports survive the move):
  ```bash
  git mv src/server/project/<your-agent> src/server/project/agent
  ```
- If the child has no agent folder at all → create `src/server/project/agent/{handler.ts,tools.ts,adapters/codex-mcp-server.ts}` (scaffold per `build-app-agent` Phase 5).

Gate: `src/server/project/agent/handler.ts` exists; no other `*-agent`/`*-coach` agent folder remains.

---

## Step 3 (state B only) — fold `runtime.ts` into the handler, then delete it

The handler path + system prompt no longer live in a seam.

1. Read the child's values from `src/apis/template/agent/runtime.ts`
   (`agentRuntime.handlerPath`, `agentRuntime.systemPrompt`).
2. In `src/server/project/agent/handler.ts`:
   - Add a `SYSTEM_PROMPT` const set to the captured prompt and pass it:
     `createAgentHandler({ agentName, systemPrompt: SYSTEM_PROMPT, … })`.
   - Remove any `codexMcpServerPath` override from `initCodex(...)` — the default
     is now the convention path `src/server/project/agent/adapters/codex-mcp-server.ts`.
   - (`handlerPath` is gone entirely — `sendMessage` uses the convention constant.)
3. Delete the seam and drop it from `projectOverrides`:
   ```bash
   git rm src/apis/template/agent/runtime.ts
   ```
   Edit `.template-sync.json` → remove `"src/apis/template/agent/runtime.ts"` from
   `projectOverrides` (leave other entries).

Gate: no `runtime.ts`; `projectOverrides` has no agent entry; handler passes `systemPrompt`.

---

## Step 4 — Sync, then verify

1. `yarn sync-template` (delivers the convention-model template files: the
   updated `sendMessage`, `createAgentHandler`, and removes the template's own
   `runtime.ts`).
2. `yarn checks` — must be fully green.
3. Smoke-test if the daemon is available: open `/agent`, send a message, confirm
   the turn streams and a tool fires. The daemon resolves
   `src/server/project/agent/handler` — make sure that's where your handler is.
4. Offer to commit (don't commit unprompted). Suggested message:
   `refactor(agent): adopt template agent convention model`.

Gate: `yarn checks` green and (if testable) a real turn works.

---

## Notes

- **Idempotent.** Re-running on a converted child hits Step 0's no-op branch.
- **The chat UI stays yours** — only its import paths change (state A).
- **Why convention beats a seam:** the agent is wholly project-owned at one fixed
  path, so there's no synced file to override and nothing to freeze out of future
  template updates. The only synced agent-adjacent seam left is the default-model
  config — override it only if you changed it.
- **Future engine fixes** (streaming, polling, attachments, stuck-pending
  recovery) arrive via `/sync-template`; you own only `src/server/project/agent/**`,
  the chat UI, and (optionally) the default-model config.
