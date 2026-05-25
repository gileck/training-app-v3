---
description: Set up the project's Telegram bot end-to-end — create the bot, capture its token + owner chat ID, push to Vercel, and register the callback webhook URL. Shared prerequisite for any skill that needs Telegram (deploy notifications, RPC approvals, agent workflow approvals).
---

# Set Up Telegram Bot (Shared Prerequisite)

Brings a project's Telegram integration to a fully-wired state:

1. **Bot exists** — `TELEGRAM_BOT_TOKEN` in `.env.local` + on Vercel (production + preview), `getMe` returns OK.
2. **Owner chat exists** — `ownerTelegramChatId` (via `OWNER_TELEGRAM_CHAT_ID` env or `appConfig.ownerTelegramChatId`) is set, the bot is a member of that chat, and a direct `sendMessage` probe lands visibly.
3. **Callback webhook is registered** — the bot's `setWebhook` URL points at *this* deployment's `/api/telegram-webhook`. This is what enables Approve / Reject inline-button flows (RPC connection approvals, agent workflow item approvals, admin signup approvals).

Other skills (`enable-rpc-calls`, `setup-vercel-deploy-notifications`) call this one as a prerequisite. **It is safe to re-run** — every step is idempotent and detects existing state before asking the user anything.

**Run this conversationally.** Each step has a verify gate. Do not advance until the verify passes — most Telegram setup failures we've seen come from skipping the visual confirmation of step 3c.

---

## What this skill does NOT do

- **Outbound Vercel-platform webhooks** (Vercel → `/api/vercel-webhook`) — that's `setup-vercel-deploy-notifications`. Different webhook, different concern: this skill registers a webhook *on the Telegram bot*, not on Vercel.
- **Per-feature wiring** — mounting the RPC indicator, scheduling the agent workflow, etc. Those belong to their feature-specific skills.

---

## Step 0 — Pre-flight

```bash
test -f .vercel/project.json || echo "NOT LINKED"
node -p "require('./package.json').name"
```

If Vercel isn't linked, run `vercel link` and walk the user through it. Re-check before continuing — pushing env vars without a link fails silently.

---

## Step 1 — Bot exists, token captured

**Goal:** `TELEGRAM_BOT_TOKEN` set in `.env.local` AND on Vercel (production + preview), with `getMe` returning OK.

### 1a. Local

```bash
if grep -q '^TELEGRAM_BOT_TOKEN=' .env.local; then
  echo "OK — token present"
else
  echo "MISSING"
fi
```

If missing, walk the user through bot creation:

1. Open Telegram → search `@BotFather` → start a chat.
2. Send `/newbot`. BotFather asks for a name and a username (username must end in `bot`).
3. BotFather replies with the token — looks like `1234567:ABC...`. Have the user paste it back here.
4. Append to `.env.local`:
   ```bash
   printf '\nTELEGRAM_BOT_TOKEN=<paste-token>\n' >> .env.local
   ```

**Each project should get its own bot.** A bot can only have one `setWebhook` URL, so two projects sharing a token = whichever ran `set` last receives all callback queries; the other project's approvals silently fail with "Unknown … request." If the user is tempted to reuse a token from another project, warn them and recommend a fresh `/newbot` instead.

### 1b. Verify the token actually works

```bash
TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' .env.local | cut -d= -f2-)
curl -s "https://api.telegram.org/bot${TOKEN}/getMe" | python3 -m json.tool
```

Expect `"ok": true` with the bot's `first_name` + `username`. If `Unauthorized`, the token is wrong — re-paste and retry. Do not proceed.

### 1c. Push to Vercel

```bash
yarn vercel-cli env:set --name TELEGRAM_BOT_TOKEN --value "$TOKEN" --target production,preview
```

(`env:set` uses the API and avoids the trailing-newline bugs `env:add`/piped input have caused.)

---

## Step 2 — Owner chat exists, bot can post in it

**Goal:** `OWNER_TELEGRAM_CHAT_ID` set in `.env.local` AND on Vercel, AND the bot has successfully sent a message into the chat that the user visually confirms.

### 2a. Decide on a chat

Options (let the user pick):

- **Direct DM with the user** — easiest. Send `/start` to the bot from the user's account; the chat ID equals their personal Telegram user ID.
- **Regular group** — add the bot as a member.
- **Forum-mode supergroup with a topic** — chat ID becomes `<groupId>:<topicId>`; the bot needs access to the specific topic.

### 2b. Capture the chat ID

```bash
yarn telegram-setup
```

This listens for the next incoming message to the bot and prints the `chat_id` (and `message_thread_id` for topics). Have the user send any message into the target chat — the script reads it and exits, printing the line to copy. Append to `.env.local`:

```bash
printf '\nOWNER_TELEGRAM_CHAT_ID=<paste-chat-id>\n' >> .env.local
```

(`appConfig.ownerTelegramChatId` in `src/app.config.js` reads this env var, with a hardcoded fallback. The env var is preferred so multiple deployments can target different chats from the same code.)

### 2c. Probe — bot can actually post to chat (CRITICAL — do not skip)

```bash
TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' .env.local | cut -d= -f2-)
CHAT_RAW=$(grep '^OWNER_TELEGRAM_CHAT_ID=' .env.local | cut -d= -f2-)
CHAT_ID="${CHAT_RAW%:*}"
THREAD_ID=""
[[ "$CHAT_RAW" == *:* ]] && THREAD_ID="${CHAT_RAW##*:}"
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  ${THREAD_ID:+-d message_thread_id=${THREAD_ID}} \
  -d "text=Telegram bot setup probe — if you see this, the bot+chat combo works." \
  | python3 -m json.tool
```

Expect `"ok": true` AND the user visually confirms the message landed.

Common failures:
- `"Bad Request: chat not found"` → bot is not a member of that chat. Add the bot to the group/topic, retry.
- `"Forbidden: bot was kicked"` → re-add the bot.
- Topic chat works for non-topic messages but topic message fails → make the bot a topic admin with "Post Messages" allowed.

**Do not proceed until the user has eyes on the probe message.** "Token works" + "chat ID set" can both be true while `sendMessage` fails (bot not in chat). The visual confirm is the only thing that catches this.

### 2d. Push chat ID to Vercel

```bash
yarn vercel-cli env:set --name OWNER_TELEGRAM_CHAT_ID --value "$CHAT_RAW" --target production,preview
```

---

## Step 3 — Register the bot's callback webhook URL

This is the step that almost everyone forgets. **A bot's `setWebhook` URL is global per bot.** Without it (or pointed at the wrong domain), every Approve / Reject button tap goes to the wrong endpoint or to nowhere.

### 3a. Get this project's production URL

You need a deployed production URL. Pull it from the Vercel API:

```bash
TEAM_ID=$(jq -r .orgId .vercel/project.json)
PROJECT_ID=$(jq -r .projectId .vercel/project.json)
VERCEL_TOKEN=$(grep '^VERCEL_TOKEN=' .env.local | cut -d= -f2-)

PROD_URL=$(curl -s "https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  | python3 -c "import sys,json; aliases=json.load(sys.stdin).get('targets',{}).get('production',{}).get('alias',[]); print(aliases[0] if aliases else '')")
echo "Production URL: $PROD_URL"
```

If `PROD_URL` is empty, no production deploy exists yet — tell the user to run `vercel --prod` (or push to main) first, then come back. Do not point Telegram at a preview URL; preview URLs are per-deploy and become stale.

If `VERCEL_TOKEN` isn't set, have the user create one (Vercel dashboard → top-right avatar → Account Settings → Tokens) and paste into `.env.local`.

### 3b. Inspect current webhook target

```bash
yarn telegram-webhook info
```

Three relevant outcomes:

| Output | Meaning | Action |
|---|---|---|
| `URL: (not set)` | Fresh bot, no webhook yet | proceed to 3c |
| `URL: https://<this-prod>/api/telegram-webhook` (matches `$PROD_URL`) | Already wired to this project | skip 3c; check 3d |
| `URL: https://<some-other-domain>/...` | Bot's webhook is owned by another deployment | **Warn the user**: setting it here breaks RPC/approval callbacks on `<some-other-domain>`. If the bot is supposed to be exclusive to this project, proceed. If it's shared, the user needs a separate bot — back to Step 1 with a new `/newbot`. |

### 3c. Set the webhook

```bash
yarn telegram-webhook set "https://${PROD_URL}/api/telegram-webhook"
```

### 3d. Final verify

```bash
yarn telegram-webhook info
```

- `URL` must match `https://${PROD_URL}/api/telegram-webhook`.
- `Last error: ...` must NOT be present. If it is, Telegram tried to deliver to the URL and failed — usually the deployment is still building, the URL has a typo, or the function returned non-2xx. Re-check after a minute.

---

## Step 4 — Redeploy (only if `TELEGRAM_BOT_TOKEN` or `OWNER_TELEGRAM_CHAT_ID` were new/changed)

Env-var changes only apply to the **next** Vercel deployment. If either var was set/changed in Steps 1c / 2d:

```bash
yarn vercel-cli redeploy --message "chore: wire Telegram bot env vars"
```

Skip this if both vars were already present and unchanged on Vercel.

---

## End-state contract

After this skill finishes, *any* caller (this skill's invokers, other features) can assume:

- `process.env.TELEGRAM_BOT_TOKEN` is valid on Vercel (production + preview) — `getMe` returns OK.
- `process.env.OWNER_TELEGRAM_CHAT_ID` is set on Vercel and the bot has confirmed `sendMessage` access to it.
- The bot delivers `callback_query` updates to `https://<this-prod>/api/telegram-webhook` with no recent `last_error_message`.

Skills that depend on this should preflight-check the **webhook URL** (`yarn telegram-webhook info`) and the **token presence** (`grep '^TELEGRAM_BOT_TOKEN=' .env.local`). If either fails, point the user at `/setup-telegram-bot` and stop.

---

## Quick checklist (agent ticks these off as you go)

- [ ] Vercel project linked
- [ ] `TELEGRAM_BOT_TOKEN` in `.env.local`, `getMe` returns OK
- [ ] `TELEGRAM_BOT_TOKEN` set on Vercel (production + preview)
- [ ] `OWNER_TELEGRAM_CHAT_ID` captured (with topic suffix if forum-mode)
- [ ] **Direct sendMessage probe returned `"ok": true` AND user visually confirmed**
- [ ] `OWNER_TELEGRAM_CHAT_ID` set on Vercel (production + preview)
- [ ] Production URL resolved (non-empty alias)
- [ ] `yarn telegram-webhook info` shows the bot's URL = `https://<this-prod>/api/telegram-webhook`
- [ ] No `last_error_message` on `getWebhookInfo`
- [ ] User warned if the bot was previously webhook'd to another deployment
- [ ] Redeploy ran (only if token or chat ID changed)
