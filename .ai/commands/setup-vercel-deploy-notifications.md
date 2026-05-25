---
description: Configure Vercel webhook → Telegram deployment notifications for the current project
---

# Setup Vercel → Telegram Deployment Notifications

Wires Vercel's deployment webhook to this project's `/api/vercel-webhook` handler so every deployment (CLI, dashboard, git push) posts to Telegram. The handler itself ships with the template — this skill is the per-project configuration walkthrough.

**Run this conversationally.** Each numbered step below has an explicit verify gate. Do not advance until the verify passes. Most setup failures we've seen come from skipping verification ("the bot exists" ≠ "the bot can post to this chat").

---

## What you (the agent) need to know up front

The handler reads three values at runtime, all from Vercel env (NOT from local `.env.local`):

| Var | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | The bot that posts the message. Each project has its own. |
| `VERCEL_TELEGRAM_CHAT_ID` *(or fallback `appConfig.ownerTelegramChatId`)* | The chat the message lands in. Can be `<id>` for a regular chat or `<id>:<topic>` for a forum topic. |
| `VERCEL_WEBHOOK_SECRET` | Used to verify HMAC-SHA1 signature on each incoming webhook. |

The handler is at `src/pages/api/vercel-webhook.ts`. The Vercel-side webhook delivery target is `https://<production-domain>/api/vercel-webhook`.

---

## Step 0 — Quick state assessment

Before asking the user anything, check current state. Run all of these to know what's already done:

```bash
# Is Vercel linked?
test -f .vercel/project.json && cat .vercel/project.json || echo "NOT LINKED"

# What's currently on Vercel?
yarn vercel-cli env 2>&1 | grep -E "TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID|VERCEL_WEBHOOK_SECRET" || true

# Does a webhook already exist? (only if you have VERCEL_TOKEN locally)
grep -q "^VERCEL_TOKEN=" .env.local 2>/dev/null && \
  curl -s "https://api.vercel.com/v1/webhooks?teamId=$(jq -r .orgId .vercel/project.json)" \
    -H "Authorization: Bearer $(grep '^VERCEL_TOKEN=' .env.local | cut -d= -f2)" \
  | python3 -c "import sys,json; [print(w['id'], w['url'], w.get('events')) for w in json.load(sys.stdin) if 'vercel-webhook' in str(w.get('url',''))]"
```

Then tell the user what's already done and what's missing, and proceed from the first unmet step.

---

## Step 1 — Vercel project must be linked

**Verify:** `.vercel/project.json` exists with `projectId` and `orgId`.

If missing:
```bash
vercel link
```
Walk the user through the prompts (team + project picker). Re-run the verify before moving on.

---

## Step 2 — Telegram bot exists, and you have its token

**Outcome of this step:** `TELEGRAM_BOT_TOKEN` is in `.env.local` AND on Vercel (production + preview), and we have its `getMe` identity printed for the next step.

### If the user does not have a bot yet for this project

Each project gets its own bot. Walk them through it:

1. Open Telegram → search `@BotFather` → start a chat.
2. Send `/newbot`. BotFather asks for a name and a username (username must end in `bot`).
3. BotFather replies with the token — looks like `1234567:ABC...`. Have the user paste it.
4. Add it to `.env.local`:
   ```bash
   printf '\nTELEGRAM_BOT_TOKEN=<paste-token>\n' >> .env.local
   ```

### Verify the token actually works

```bash
TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' .env.local | cut -d= -f2-)
curl -s "https://api.telegram.org/bot${TOKEN}/getMe" | python3 -m json.tool
```

Expect `"ok": true` with the bot's `first_name` + `username`. If it returns `Unauthorized`, the token is wrong — go back and re-paste.

### Push token to Vercel

```bash
yarn vercel-cli env:set --name TELEGRAM_BOT_TOKEN --value "$TOKEN" --target production,preview
```

(Use `env:set`, NOT `env:add` or piped input — `env:set` uses the Vercel API and avoids trailing-newline bugs.)

---

## Step 3 — Target chat exists, and the bot is a member

**This is the step that bites people.** `TELEGRAM_BOT_TOKEN` being set doesn't mean the bot can post anywhere — Telegram blocks `sendMessage` with `Bad Request: chat not found` if the bot isn't added to the target chat.

### 3a. Decide on a chat

Options the user picks from:

- **A direct DM with the user** — easiest. The user starts a chat with their bot, sends `/start`, and the chat ID is their personal Telegram user ID.
- **A regular group** — add the bot as a member.
- **A forum-mode supergroup with topics** — chat ID becomes `<groupId>:<topicId>`. Bot needs access to the specific topic.

### 3b. Capture the chat ID

```bash
yarn telegram-setup
```

This listens for incoming messages to the bot and prints the `chat_id` (and `message_thread_id` for topics). Have the user send any message in the target chat — the script reads it and exits. The output line tells them the chat ID to use.

Add to `.env.local`:
```bash
printf '\nVERCEL_TELEGRAM_CHAT_ID=<paste-chat-id>\n' >> .env.local
```

### 3c. Verify the bot can actually post (CRITICAL)

```bash
TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' .env.local | cut -d= -f2-)
CHAT_RAW=$(grep '^VERCEL_TELEGRAM_CHAT_ID=' .env.local | cut -d= -f2-)
CHAT_ID="${CHAT_RAW%:*}"
THREAD_ID=""
[[ "$CHAT_RAW" == *:* ]] && THREAD_ID="${CHAT_RAW##*:}"
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  ${THREAD_ID:+-d message_thread_id=${THREAD_ID}} \
  -d "text=Webhook setup probe — if you see this, the bot+chat combo works." \
  | python3 -m json.tool
```

Expect `"ok": true` and the user actually sees the message in their chat.

Common failures:
- `"Bad Request: chat not found"` → bot is not a member of that chat. Have the user add the bot to the group/topic, then retry.
- `"Forbidden: bot was kicked"` → user kicked the bot. Re-add.
- Topic message fails but non-topic works → topic has the bot restricted. Make the bot an admin with "Post Messages" allowed in that topic.

**Do not proceed past this step until this probe returns `"ok": true` AND the user confirms visually.** Skipping this is what cost us 2 hours of head-scratching.

### 3d. Push chat ID to Vercel

```bash
yarn vercel-cli env:set --name VERCEL_TELEGRAM_CHAT_ID --value "$CHAT_RAW" --target production,preview
```

---

## Step 4 — Create the Vercel webhook

Use the API path when possible — it's faster than dashboard clicking and returns the secret directly.

### Path A (preferred): via Vercel REST API

Requires `VERCEL_TOKEN` in `.env.local`. If the user doesn't have one yet:
- Vercel dashboard → top-right avatar → Account Settings → Tokens → Create Token (scope: "Full Account" or limited to this team).
- Paste into `.env.local`:
  ```bash
  printf '\nVERCEL_TOKEN=<paste>\n' >> .env.local
  ```

Get the production URL:

```bash
TEAM_ID=$(jq -r .orgId .vercel/project.json)
PROJECT_ID=$(jq -r .projectId .vercel/project.json)
VERCEL_TOKEN=$(grep '^VERCEL_TOKEN=' .env.local | cut -d= -f2-)

PROD_URL=$(curl -s "https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  | python3 -c "import sys,json; aliases=json.load(sys.stdin).get('targets',{}).get('production',{}).get('alias',[]); print(aliases[0] if aliases else '')")
echo "Production URL: $PROD_URL"
```

If `PROD_URL` is empty: the project hasn't had a production deploy yet. Tell the user to do one first (`vercel --prod` or push to main), then retry.

Create the webhook:

```bash
RESPONSE=$(curl -s -X POST "https://api.vercel.com/v1/webhooks?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://${PROD_URL}/api/vercel-webhook\",
    \"events\": [\"deployment.created\",\"deployment.succeeded\",\"deployment.error\",\"deployment.canceled\"],
    \"projectIds\": [\"${PROJECT_ID}\"]
  }")
echo "$RESPONSE" | python3 -m json.tool
SECRET=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('secret',''))")
echo "Captured secret: $SECRET"
```

### Path B (fallback): via Vercel dashboard

1. `https://vercel.com/<team>/<project>/settings/webhooks`
2. Click **Create**.
3. **URL**: `https://<your-deployed-production-domain>/api/vercel-webhook`
4. **Events**: `deployment.created`, `deployment.succeeded`, `deployment.error`, `deployment.canceled`. **Do not** subscribe to `deployment.promoted` — it fires alongside `succeeded` for git-push deploys and produces duplicate "deployment live" messages.
5. **Project scope**: this project only.
6. Click **Create**. The dashboard shows the **secret** exactly once — copy it now.

---

## Step 5 — Push the webhook secret to Vercel

```bash
yarn vercel-cli env:set --name VERCEL_WEBHOOK_SECRET --value "<secret-from-step-4>" --target production,preview
```

**Do not** scope it to `development` — webhooks only hit deployed URLs.

---

## Step 6 — Redeploy so Vercel functions pick up the new env vars

Env-var changes only apply to the **next** deployment. Trigger one:

```bash
yarn vercel-cli redeploy --message "chore: enable Vercel deploy webhook"
```

(Pushes an empty commit to main → Vercel auto-deploys.)

---

## Step 7 — Verify end-to-end

Once the deploy from Step 6 is READY (usually 1–2 min), the user should see **two** Telegram messages in their target chat:

1. 🚀 *Production deployment started* — `<project-name>` (no Repository line, with 🔗 Open / 🔍 Inspector / 📋 Commit buttons)
2. ✅ *Production deployment live* — `<project-name>` (same button set)

Heads-up on FIRST verification: because we just rotated the secret, Vercel's `deployment.created` event may arrive at the still-running OLD function instance (which has no `VERCEL_WEBHOOK_SECRET` → 500) before the new deploy goes live. Vercel will retry, but the "started" message may arrive AFTER the "live" message on this one-time transition. Every subsequent deploy fires in the natural order.

If neither message arrives:

| Symptom | Cause | Fix |
|---|---|---|
| Vercel dashboard → Webhook → Deliveries shows 401 | Secret mismatch | Re-run Step 5 and Step 6 |
| Deliveries shows 500 | Handler crashed | `yarn vercel-cli logs --deployment <id>` and look for `[vercel-webhook]` |
| Deliveries shows 200 but no Telegram | Bot can't post to chat | Re-run Step 3c probe directly from terminal |
| No deliveries at all | Webhook not subscribed to the events OR scoped to wrong project | Step 4 — recreate |

---

## Quick verification (one-off, after setup)

After setup is done, you can re-confirm by sending a signed test directly to the deployed handler — useful when changing the chat ID or bot:

```bash
SECRET="<the-real-secret>"
PAYLOAD='{"type":"deployment.succeeded","payload":{"deployment":{"name":"smoke","url":"smoke.vercel.app","target":"production","meta":{"githubCommitMessage":"manual smoke","githubCommitAuthorName":"agent","githubCommitRef":"main"}},"project":{"name":"smoke"}}}'
SIG=$(printf '%s' "$PAYLOAD" | openssl dgst -sha1 -hmac "$SECRET" | awk '{print $NF}')
curl -i -X POST "https://<production-domain>/api/vercel-webhook" \
  -H "Content-Type: application/json" \
  -H "x-vercel-signature: $SIG" \
  --data-binary "$PAYLOAD"
```

Expect `HTTP/2 200` + `{"ok":true}` AND a Telegram message in the target chat.

---

## What lives where

| Piece | Location |
|---|---|
| Webhook handler | `src/pages/api/vercel-webhook.ts` (template, synced) |
| Telegram send | `sendTelegramNotification` in `src/server/template/telegram` |
| Bot identity | `@BotFather` on Telegram (one bot per project) |
| Bot token | `TELEGRAM_BOT_TOKEN` env var on Vercel |
| Target chat | `VERCEL_TELEGRAM_CHAT_ID` env var on Vercel (falls back to `appConfig.ownerTelegramChatId`) |
| Signing secret | `VERCEL_WEBHOOK_SECRET` env var on Vercel |
| Vercel webhook config | Vercel dashboard → project → Settings → Webhooks (or REST `/v1/webhooks`) |

---

## Quick checklist (agent ticks these off as you go)

- [ ] Vercel project linked (`.vercel/project.json` exists)
- [ ] Bot created with @BotFather, `TELEGRAM_BOT_TOKEN` in `.env.local`
- [ ] Bot's `getMe` returns `"ok": true`
- [ ] `TELEGRAM_BOT_TOKEN` set on Vercel (production + preview)
- [ ] Chat ID captured (and topic ID if forum-mode)
- [ ] **Direct sendMessage probe to chat returned `"ok": true` AND user visually confirmed**
- [ ] `VERCEL_TELEGRAM_CHAT_ID` set on Vercel (production + preview)
- [ ] Vercel webhook created with the 4 deployment events, scoped to this project only
- [ ] Webhook secret captured
- [ ] `VERCEL_WEBHOOK_SECRET` set on Vercel (production + preview)
- [ ] Redeploy run
- [ ] Test deploy produced both started + live messages
