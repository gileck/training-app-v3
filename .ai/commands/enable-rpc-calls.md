---
description: Enable RPC calls in a child project — register the local daemon as a task-cli daemon, mount the RPC indicator in the top nav, and verify end-to-end.
---

# Enable RPC Calls (Child Project)

Wires the template's RPC-over-MongoDB transport into a child project:
1. Registers `yarn daemon` as a managed daemon task via `task-cli` (auto-restart, log capture).
2. Mounts `RpcConnectionIndicator` in the top nav so admins can Connect / Test / Stop from any page.
3. Verifies the daemon is up and tells the user exactly what to click to test.

The RPC system itself (daemon code, gate, `/admin/rpc-connection` page) ships with the template — this skill is the per-project install + wiring.

**Run this conversationally.** Each step has a verify gate. Do not advance until the verify passes.

---

## Background the agent needs

| Piece | Where | Owner |
|---|---|---|
| Daemon script | `src/server/template/rpc/daemon.ts` (run via `yarn daemon`) | template |
| Connection gate + indicator UI | `src/server/template/rpc/`, `src/client/features/template/rpc-connection/` | template |
| `RpcConnectionIndicator` mount | `src/client/components/project/NavLinks.project.tsx` → `TopNavBarRightSlot` | **project** |
| task-cli daemon registration | `agent-tasks/rpc-daemon/config.json` | **project** (not synced) |
| `RPC_SECRET` env var | `.env.local` (local) + Vercel (production+preview) | shared between sides |
| `MONGO_URI` env var | `.env.local` (local) + Vercel | shared (already present) |
| MongoDB database name | `appConfig.dbName` in `src/app.config.js` | **project** (must be set before this skill runs) |
| Telegram bot + owner chat + `setWebhook` URL | bot exists, chat ID set, bot's webhook URL points at this deployment | covered by `/setup-telegram-bot` (this skill preflights and delegates) |

Both sides of the transport (Vercel + local daemon) must share the **same** `RPC_SECRET`, the **same** `MONGO_URI`, and resolve to the **same** database name (via `appConfig.dbName`). Anything else and the daemon will silently poll a different DB from the one Vercel writes jobs to — every `callRemote` hangs until the pending-pickup timeout fires.

The gate is admin-only in v1 (route + APIs gated to `ADMIN_USER_ID`), so the indicator self-hides for non-admins. Telegram approval + bot setup must already be in place — if not, this skill blocks at Step 5 and points the user at `setup-vercel-deploy-notifications` / `yarn telegram-setup`.

---

## Step 0 — Pre-flight

```bash
# Must be a child project, not the template itself
node -p "require('./package.json').name"
```

If the name is `app-template-ai`, **refuse** with: "This skill is for child projects. The template repo already has its own rpc-daemon task — don't double-register it."

Then:

```bash
git status --porcelain
```

If dirty, ask the user to commit or stash first. This skill edits a project-owned file (`NavLinks.project.tsx`) and writes a new config; rollback on a dirty tree is messy.

```bash
# Confirm the daemon script exists in package.json
node -p "require('./package.json').scripts.daemon || ''"
```

Empty result → the template's `daemon` script hasn't been synced yet. Tell the user to run a template sync first; do not proceed.

```bash
# Confirm task-cli is installed and the Task Manager app is running
task-cli status >/dev/null 2>&1 && echo OK || echo "task-cli not reachable"
```

If not reachable, tell the user: install `task-cli` and make sure the Task Manager app is running, then re-run this skill.

---

## Step 1 — Ensure `MONGO_URI` is present locally

```bash
grep -q '^MONGO_URI=' .env.local && echo OK || echo MISSING
```

If missing, **stop**. RPC needs MongoDB — the user must finish DB setup first. Don't fabricate a value.

---

## Step 2 — Ensure `RPC_SECRET` is present locally and on Vercel

The same secret must live in both places. If only one side has it (or the values differ), the daemon will silently reject every job.

### 2a. Local

```bash
if grep -q '^RPC_SECRET=' .env.local; then
  echo "OK — using existing value"
else
  SECRET=$(openssl rand -hex 32)
  printf '\nRPC_SECRET=%s\n' "$SECRET" >> .env.local
  echo "Generated and wrote RPC_SECRET to .env.local"
fi
```

### 2b. Vercel

```bash
SECRET=$(grep '^RPC_SECRET=' .env.local | cut -d= -f2-)
yarn vercel-cli env:set --name RPC_SECRET --value "$SECRET" --target production,preview
```

(Use `env:set`, not `env:add` or piped input — it uses the Vercel API and avoids trailing-newline bugs that have bitten us before.)

After pushing, the user must redeploy for the new env to take effect — but defer that to Step 6 so we only redeploy once.

**Verify** the value matches both sides:

```bash
LOCAL=$(grep '^RPC_SECRET=' .env.local | cut -d= -f2- | head -c 8)
REMOTE=$(yarn vercel-cli env:get --name RPC_SECRET --target production 2>/dev/null | tail -1 | head -c 8)
[[ "$LOCAL" == "$REMOTE" ]] && echo "MATCH" || echo "MISMATCH"
```

If `MISMATCH`, re-run 2b and recheck. Do not proceed until the first 8 chars match.

### 2c. Optional but recommended — local dev shortcut (skip the approval gate)

By default `RPC_CONNECTION_ENABLED` is `true`, so **every** RPC caller — including
the in-app agent's `agent/sendMessage` → `createRpcJob` — is blocked until an admin
clicks Connect and approves it via Telegram. That ceremony is correct for
production, but painful in local dev: without it, sending an agent message just
errors with *"RPC connection required"*. Set these **local-only** flags in
`.env.local` to bypass it on your machine:

```bash
grep -q '^RPC_CONNECTION_ENABLED=' .env.local || printf 'RPC_CONNECTION_ENABLED=false\n' >> .env.local
grep -q '^RPC_LOCAL_DIRECT=' .env.local || printf 'RPC_LOCAL_DIRECT=true\n' >> .env.local
```

- `RPC_CONNECTION_ENABLED=false` short-circuits `assertRpcConnection` (`rpc/connection-gate.ts`) so no Connect/approve is needed locally. **This is the flag that unblocks the agent.**
- `RPC_LOCAL_DIRECT=true` runs `callRemote` handlers in-process (skips the daemon) for *non-agent* RPC features. ⚠️ It does **not** apply to the agent — `agent/sendMessage` uses `createRpcJob` (fire-and-forget), so **`yarn daemon` must still be running** for an agent turn to execute. It's set here for parity with the template's local env.

🔒 These are `.env.local`-only. **Never** push them to Vercel — `RPC_CONNECTION_ENABLED=false` would disable the production approval gate, and `RPC_LOCAL_DIRECT=true` would make production try to run handlers from the blocked datacenter IP. Restart `next dev` after editing `.env.local` for the change to load.

---

## Step 3 — Register the daemon with task-cli

The template's own `agent-tasks/rpc-daemon/config.json` is a reference, **but it points at the template's working directory** — child projects need their own.

### 3a. Derive the values

```bash
REPO_NAME=$(node -p "require('./package.json').name")
PROJECT_DIR=$(pwd)

# Read the project's MongoDB database name from src/app.config.js.
# The daemon polls THIS database (via src/server/database/connection.ts,
# which reads appConfig.dbName). It MUST match the database Vercel writes
# jobs to — same MONGO_URI + same dbName on both sides.
DB_NAME=$(node -e "console.log(require('./src/app.config.js').appConfig.dbName)")

echo "Repo:    $REPO_NAME"
echo "DB name: $DB_NAME"
echo "Dir:     $PROJECT_DIR"
```

If `DB_NAME` is empty or still equals `app_template_db` (the template's placeholder), **stop**. The child project hasn't customized `appConfig.dbName` yet — running the daemon against the template's name would either fail or pollute the wrong DB. Tell the user to set `dbName` in `src/app.config.js` to their project's own database name first, then re-run this skill.

### 3b. Write the config

```bash
mkdir -p agent-tasks/rpc-daemon/runs
```

Then write `agent-tasks/rpc-daemon/config.json` with the derived values spliced in (replace `<repo-name>`, `<db-name>`, and `<project-dir>` literally — do not leave placeholders):

```json
{
  "name": "RPC Daemon (<repo-name> / <db-name>)",
  "uniqueKey": "<repo-name>:rpc-daemon",
  "groupName": "<repo-name>",
  "description": "Polls MongoDB database '<db-name>' for remote function calls and executes locally (residential IP)",
  "script": {
    "path": "daemon",
    "args": ["--verbose"],
    "interpreter": "npm",
    "workingDirectory": "<project-dir>"
  },
  "schedule": {
    "type": "daemon"
  },
  "daemon": {
    "restartDelayMs": 5000,
    "maxRestarts": 5,
    "restartWindowMs": 300000,
    "healthyRunMs": 60000
  },
  "notifications": {
    "onStart": false,
    "onSuccess": false,
    "onFailure": true
  },
  "options": {
    "enabled": true,
    "allowParallelRuns": false,
    "requiresInternet": true
  },
  "output": {
    "logFile": "<project-dir>/agent-tasks/rpc-daemon/runs/output.log",
    "statusFile": "<project-dir>/agent-tasks/rpc-daemon/runs/status.json"
  }
}
```

Key points (do not edit silently):
- `uniqueKey` must be `<repo-name>:rpc-daemon` so it doesn't collide with the template's `app-template-ai:rpc-daemon` or other projects' daemons in task-cli.
- `schedule.type: "daemon"` (NOT `interval`) — this is a long-running process, not a polled cron.
- `workingDirectory` must be the **project's own root**, not `agents-copy/<repo>` (the workflow agents use agents-copy; the daemon uses the live repo because it imports project handlers from `src/server/project/**`).
- `output.logFile` must be absolute — task-cli does not resolve relative paths.

### 3c. Register

```bash
task-cli create --config=./agent-tasks/rpc-daemon/config.json
```

If task-cli reports the key already exists, the user re-ran the skill or set it up manually. Confirm before overwriting:

```bash
task-cli edit "<repo-name>:rpc-daemon" --config=./agent-tasks/rpc-daemon/config.json
```

### 3d. Start it (task-cli does NOT auto-start a freshly-created daemon)

```bash
task-cli daemon start "<repo-name>:rpc-daemon"
```

---

## Step 4 — Mount the indicator in the top nav

Edit `src/client/components/project/NavLinks.project.tsx` (project-owned, never synced).

If the file is missing the import, add it at the top:

```ts
import { RpcConnectionIndicator } from '@/client/features/template/rpc-connection';
```

Then ensure `TopNavBarRightSlot` returns the indicator. If the slot is already exported with other content, compose them in a flex row — don't overwrite existing controls:

```tsx
// New project — slot was previously `null`
export const TopNavBarRightSlot = (): ReactNode => <RpcConnectionIndicator />;

// Project already uses the slot for something else — compose:
export const TopNavBarRightSlot = (): ReactNode => (
  <div className="flex items-center gap-2">
    <RpcConnectionIndicator />
    <ExistingPill />
  </div>
);
```

Heads-up: `RpcConnectionIndicator` self-hides for non-admins via `useIsAdmin()`, so it's safe to mount unconditionally — don't add an extra admin gate around it.

**Verify** the edit:

```bash
yarn checks
```

Must end with 0 errors before continuing. If TypeScript flags an unused import or a missing slot type, fix in place — do not paper over with `eslint-disable`.

---

## Step 5 — Verify the daemon is up

```bash
task-cli daemon list 2>&1 | grep -E "<repo-name>:rpc-daemon"
```

Status must be `Up`. If it's `Down` / `Failed (crash loop)`, stream the log to find out why:

```bash
task-cli daemon logs "<repo-name>:rpc-daemon"
# Ctrl+C after a few seconds — we just want the first error
```

Common failures and what they mean:

| Log line | Cause | Fix |
|---|---|---|
| `MONGO_URI is required` | env var missing from the daemon's process env | Daemon reads `.env.local` via `src/agents/shared/loadEnv` — confirm it exists at the project root |
| `MongoServerError: bad auth` | wrong `MONGO_URI` | Re-paste from your Atlas dashboard, confirm user/password URL-encoded |
| `RPC_SECRET is required` | missing local secret | Step 2a |
| `Error: Cannot find module 'tsx'` | `node_modules` missing | `yarn install` in the project dir |
| `EADDRINUSE` / `lock` errors | another daemon already polling | `task-cli daemon list` — kill the duplicate |

Re-start after fixing:

```bash
task-cli daemon restart "<repo-name>:rpc-daemon"
```

Tail the log and confirm you see the `[rpc-daemon] polling for jobs...` line (verbose mode) before moving on. If you don't see it within ~5 seconds, the daemon never reached the poll loop — keep debugging.

---

## Step 6 — Redeploy Vercel (only if Step 2b set/changed `RPC_SECRET`)

If you generated a new secret in Step 2a, env-var change only applies to the **next** Vercel deployment:

```bash
yarn vercel-cli redeploy --message "chore: enable RPC daemon — set RPC_SECRET"
```

Skip this if `RPC_SECRET` was already present and unchanged on Vercel.

---

## Step 7 — Verify the Telegram bot is wired (delegates to `/setup-telegram-bot`)

The RPC approval flow uses Telegram inline buttons. That requires three things to be set up on the project's bot:

1. `TELEGRAM_BOT_TOKEN` valid on Vercel.
2. `OWNER_TELEGRAM_CHAT_ID` set on Vercel + bot can post into that chat.
3. The bot's `setWebhook` URL points at **this** deployment's `/api/telegram-webhook` (per-bot global — must be set, not inherited).

All three are handled by the shared `/setup-telegram-bot` skill. Preflight-detect them here, and hand off if anything is missing.

### 7a. Detect state

```bash
# Token present locally?
grep -q '^TELEGRAM_BOT_TOKEN=' .env.local && echo "TOKEN OK" || echo "TOKEN MISSING"

# Chat ID present locally?
grep -q '^OWNER_TELEGRAM_CHAT_ID=' .env.local && echo "CHAT OK" || echo "CHAT MISSING"

# Webhook URL matches THIS prod?
WEBHOOK_URL=$(yarn -s telegram-webhook info 2>/dev/null | awk -F'URL: ' '/^URL: / {print $2}')
echo "Webhook URL: ${WEBHOOK_URL:-(not set)}"
```

The webhook URL is the most common miss. Symptom of skipping it: tapping **Approve** on the Telegram message replies with `⚠️ Unknown connection request` and the connection stays pending — because Telegram delivered the `callback_query` to the wrong deployment's `/api/telegram-webhook`, which queried its own DB and found no matching `rpc_connections` row.

### 7b. Hand off if anything's missing

If any of the three checks fail, **stop this skill** and tell the user:

> Telegram bot isn't fully wired for this project. Run `/setup-telegram-bot` first — it handles bot creation (if needed), the owner chat ID, and the bot's `setWebhook` URL. Re-run `/enable-rpc-calls` after it completes.

Do not try to inline the bot setup here — it duplicates the shared skill, drifts out of sync, and skips its visual-confirmation gates. The only thing we verify in this skill is *that bot setup is done*.

### 7c. Fast-path if everything's already set

If all three checks pass and `WEBHOOK_URL` resolves to a URL that contains this project's production domain, proceed to Step 8.

If `WEBHOOK_URL` is set but points at a *different* deployment (e.g., the template's, or another project's), the user has a shared-bot situation — running `/setup-telegram-bot` will re-point the webhook to *this* project and break callbacks on the other deployment. Surface the conflict before doing it; recommend a separate bot if both projects need to work.

---

## Step 8 — Tell the user how to test

End the skill with these instructions. Do not click these yourself — the test requires Telegram approval from the human admin.

> **You're set up. To verify end-to-end:**
>
> 1. Open the app and sign in as the admin user (the one matching `ADMIN_USER_ID`).
> 2. You should now see a small **`RPC ●`** pill in the top-right of the header. The dot is **gray** (offline session).
> 3. Click it → opens a dialog → click **Connect**. The dot turns **yellow** (pending approval).
> 4. Check your owner Telegram chat — there's a message with **✅ Approve** / **❌ Reject** buttons. Tap **Approve**.
> 5. The dot turns **green**. Click **Test** in the dialog (or go to `/admin/rpc-connection` → Test).
> 6. Within ~2 seconds it should report **success** with a round-trip latency. That confirms: Vercel → MongoDB → daemon → MongoDB → Vercel all working.
>
> If **Test** hangs and eventually fails with *"No RPC daemon picked up the job…"*, the daemon isn't actually polling — go back to Step 5 and re-check `task-cli daemon list` + logs.
>
> If Connect fails because no Telegram message arrives, the owner chat isn't configured. Run `yarn telegram-setup` and verify `appConfig.ownerTelegramChatId` is set.
>
> If the Telegram message arrives but tapping **Approve** replies with **⚠️ Unknown connection request**, the bot's webhook is pointed at the wrong deployment — Step 7's webhook check was stale or the bot is shared with another project. Run `/setup-telegram-bot` to re-register the webhook URL at this deployment.

---

## Quick checklist (agent ticks these off as you go)

- [ ] Confirmed this is a child project (`package.json` name ≠ `app-template-ai`)
- [ ] Git tree clean
- [ ] `package.json` has the `daemon` script (template synced)
- [ ] `task-cli status` reachable
- [ ] `MONGO_URI` in `.env.local`
- [ ] `RPC_SECRET` in `.env.local`
- [ ] `RPC_SECRET` pushed to Vercel (production + preview), first 8 chars match local
- [ ] `appConfig.dbName` in `src/app.config.js` is the project's own DB name (not `app_template_db`)
- [ ] `agent-tasks/rpc-daemon/runs/` exists
- [ ] `agent-tasks/rpc-daemon/config.json` written with `uniqueKey: <repo>:rpc-daemon`, `<db-name>` spliced into `name` + `description`, absolute paths, `schedule.type: "daemon"`
- [ ] `task-cli create` succeeded (or `edit` if pre-existing)
- [ ] `task-cli daemon start <repo>:rpc-daemon` ran
- [ ] `NavLinks.project.tsx` imports `RpcConnectionIndicator` and exports it via `TopNavBarRightSlot`
- [ ] `yarn checks` passes (0 errors)
- [ ] `task-cli daemon list` shows the daemon as **Up**
- [ ] Daemon log shows `polling for jobs...`
- [ ] Vercel redeployed (only if `RPC_SECRET` was new/changed)
- [ ] Telegram bot wired (`TELEGRAM_BOT_TOKEN` + `OWNER_TELEGRAM_CHAT_ID` set, `yarn telegram-webhook info` shows this deployment's URL with no `last_error_message`) — handed off to `/setup-telegram-bot` if not
- [ ] User instructed to Connect → approve in Telegram → Test
- [ ] (Optional, Step 2c) `RPC_CONNECTION_ENABLED=false` + `RPC_LOCAL_DIRECT=true` in `.env.local` for a frictionless local loop — **local only, never on Vercel**
