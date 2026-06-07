---
description: Remove leftover github-agents-workflow code from a child project after a template sync. The template removed the AI feature/bug pipeline (src/agents, workflow-service, workflow-items, the workflow/agent-decision/agent-log/clarification APIs, the GitHub bridge, and the workflow Telegram callbacks). Sync deletes the still-globbed template modules but ORPHANS the de-globbed paths (src/agents/, src/pages/api/feature-requests/, src/pages/design-mocks/) plus project-local remnants (agent-tasks workflow configs, agent-logs/, package.json agent scripts, vitest.config). This skill deletes those orphans so `yarn checks` passes. Idempotent — no-ops if already clean. Does NOT touch the in-app AI chat agent, the RPC daemon, or general Telegram.
---

# Cleanup Workflow Code (Child Project)

The template removed the **github-agents-workflow** system (the 9-status AI feature/bug pipeline + its agents). When a child project runs `yarn sync-template`, the deletions under the *still-globbed* template paths propagate (so `src/server/template/workflow-service/`, `workflow-items`, `project-management/`, `github-sync/`, `github-status/`, the `workflow` / `agent-decision` / `agent-log` / `clarification` APIs, and the decoupled `feature-requests` / `reports` / `telegram-webhook` all arrive correctly).

But three paths were **removed from `templatePaths`** in the template. In the path-ownership model, a de-globbed path stops being *managed* by sync — so sync will **not** delete it in the child; it just becomes an **orphan** whose dependencies were deleted out from under it. Those orphans, plus a few project-local remnants, cause `yarn checks` to fail with `Cannot find module '@/server/template/workflow-service'` and friends.

This skill deletes those orphans. **Run it once in the child after the sync that brought in the workflow removal.**

> 🔒 **Do NOT touch these — they are different systems that stay:**
> - The **in-app AI chat agent**: `src/server/template/agentic/**`, `src/server/project/**-agent/**` (e.g. `ai-doctor-agent`), the `agent` API domain (`src/apis/template/agent`, `src/apis/project/**`), `agent-api-tools`, and the `agentTraces` / `agentQuestions` / `agentConversations` collections.
> - The **RPC system**: `src/server/template/rpc/**`, `agent-tasks/rpc-daemon/`, `yarn daemon`.
> - **General Telegram** (the webhook, `send-telegram`, setup scripts) and the kept `feature-requests` / `reports` features (already decoupled by the synced template code — leave them).

**Run this conversationally. Each step has a verify gate — do not advance until it passes.**

---

## Step 0 — Detect (no-op guard)

- **Objective:** See whether this child still has the orphans. If none, stop.
- **Actions** — run from the project root:
  ```bash
  for p in src/agents src/pages/api/feature-requests src/pages/design-mocks \
           agent-tasks/all agent-tasks/triage agent-tasks/repo-commits-code-reviewer agent-logs; do
    [ -e "$p" ] && echo "ORPHAN: $p" || echo "clean:  $p"
  done
  grep -nE '"(github-workflows-agent|agent-workflow|agent:[a-z-]+)":' package.json || echo "no agent scripts in package.json"
  grep -n "src/agents" vitest.config.ts 2>/dev/null || echo "vitest.config.ts clean (or absent)"
  ```
- **Verify:** If everything prints `clean:` / `no agent scripts` / `vitest clean` **and** `yarn checks` already passes → this child is done, **stop here**. Otherwise continue.

---

## Step 1 — Delete the orphaned source directories

These are the de-globbed paths sync leaves behind. They are template-origin code (children don't customize them), so deleting them is safe. `task-manager/` is the analogous orphan from the earlier **task-manager removal** — it was never a synced path, so the child still has it, and its `tasks-cli.ts` imports the now-relocated `loadEnv`, breaking checks; remove it too.

- **Actions:**
  ```bash
  git rm -r --quiet --ignore-unmatch \
    src/agents \
    src/pages/api/feature-requests \
    src/pages/design-mocks \
    task-manager
  ```
  If any of those weren't git-tracked, also remove the on-disk leftovers:
  ```bash
  rm -rf src/agents src/pages/api/feature-requests src/pages/design-mocks task-manager
  ```
- **Note:** Keep `src/pages/api/telegram-webhook/` and `src/pages/api/telegram-webhook.ts` — those are general Telegram (synced, already decoupled). Only the `feature-requests/` REST dir (the old public approve endpoint) goes.
- **Verify:** `ls src/agents src/pages/api/feature-requests src/pages/design-mocks task-manager 2>&1` → all "No such file or directory".

> **Batch alternative:** to clean **all** child projects at once instead of per-project, run `bash scripts/template/cleanup-workflow-code-all.sh` from the template (dry-run; add `--apply`). It discovers children via `.template-sync.json`, gates on sync state, and performs Steps 1–4 for each.

---

## Step 2 — Remove the workflow cron task configs (keep rpc-daemon)

`agent-tasks/` is project-local (not synced). Remove only the workflow agent tasks; **keep `agent-tasks/rpc-daemon/`**.

- **Actions:**
  ```bash
  git rm -r --quiet --ignore-unmatch \
    agent-tasks/all agent-tasks/triage agent-tasks/repo-commits-code-reviewer
  rm -rf agent-tasks/all agent-tasks/triage agent-tasks/repo-commits-code-reviewer agent-logs
  ```
  If `agent-tasks/README.md` lists the removed tasks (`all/`, `triage/`, `repo-commits-code-reviewer/`), trim it to describe only `rpc-daemon/` (mirror the template's `agent-tasks/README.md`).
- **Verify:** `ls agent-tasks/` shows only `rpc-daemon/` (and `README.md`).

---

## Step 3 — Clean `package.json` scripts

`package.json` is project-owned, so the child keeps its old agent scripts. Remove every script whose command references `src/agents/` or a now-deleted `scripts/template/*` file.

- **Actions:** Remove these script keys if present (leave everything else, especially `daemon` / `daemon:dev`):
  - `github-workflows-agent`, `agent-workflow`, and all `agent:*` (`agent:product-dev`, `agent:product-design`, `agent:tech-design`, `agent:implement`, `agent:bug-investigator`, `agent:pr-review`, `agent:workflow-review`, `agent:auto-advance`, `agent:triage`, `agent:code-reviewer`, `agent:logs`)
  - agent-only helpers (their target scripts were deleted from the template): `investigate-bugs`, `setup-github-secrets`, `sync-agent-logs`, `audit-feature-status`, `verify-setup`, `init-agents-copy`, `copy-to-agents`, `test-s3-logging`, `test-cursor-adapter`, `test-gemini-adapter`, `test-openai-codex-adapter`, `test-codex-sdk`, `test-all-adapters`, `test-clarification-flow`
  - Also drop the `task` script (`tsx task-manager/tasks-cli.ts`) — its target is removed in Step 1.
  - **Rule of thumb:** if a script's command references `src/agents/` or `task-manager/`, or points to a `scripts/template/<file>` that no longer exists on disk, delete it.
- **Keep:** `daemon`, `daemon:dev`, `setup-s3-logging`, `telegram-*`, `github-pr`, `verify-credentials`, `verify-production`, and all non-agent scripts.
- **Verify:** `grep -nE '"(github-workflows-agent|agent-workflow|agent:)' package.json` → no matches.

---

## Step 4 — Fix `vitest.config.ts` (if it points at deleted agent tests)

The old config's `include` / `setupFiles` referenced `src/agents/tests/**`, which no longer exists.

- **Actions:** If `grep -q "src/agents" vitest.config.ts` matches, replace the `test` block's `include` with a generic glob and drop the agent `setupFiles`:
  ```ts
  test: {
    globals: true,
    testTimeout: 30_000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    passWithNoTests: true,
  },
  ```
- **Verify:** `grep "src/agents" vitest.config.ts` → no matches.

---

## Step 5 — (Optional) Local permission entries

`.claude/settings.local.json` is local/dev-only and harmless, but for tidiness remove any `Bash(yarn agent:*)`, `Bash(github-workflows-agent...)`, `Bash(yarn agent-workflow...)` allow-list entries.

---

## Step 6 — Verify

- **Actions:** `yarn checks`
- **Expected:** All four checks pass (TypeScript, ESLint, circular deps, unused deps).
- **If TypeScript still fails:**
  - Errors mentioning `@/server/template/workflow-service`, `workflow-items`, `project-management`, `agent-decision`, `agent-log`, `@/agents/` → a workflow orphan was missed. Re-run the Step 0 detect and grep `grep -rln "@/agents/\|workflow-service\|workflow-items\|project-management\|agent-decision\|agent-log" src` to find and delete the offending leftover file.
  - Errors mentioning **`createAgentHandler` / `AgentHandlerConfig` / `src/server/project/*-agent` / `agentic`** → these are **NOT** part of this cleanup. They're the in-app AI chat agent adapting to a separate template change. Leave them for `/fix-checks` or a dedicated migration — do not "fix" them by deleting the in-app agent.
- **Verify:** `yarn checks` exits 0.

---

## Step 7 — Commit

Once green:
```bash
git add -A
git commit -m "chore: remove leftover github-agents-workflow code after template sync"
```

Report to the user: what was deleted, that `yarn checks` passes, and flag separately any in-app-agentic (`AgentHandlerConfig`) errors you intentionally left untouched.
