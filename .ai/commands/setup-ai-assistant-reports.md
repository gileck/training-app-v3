---
description: Set up AI Assistant reports — wire this project to forward its bug reports & feature requests into an external assistant app's project as tasks. Verifies the (synced) template code is present, captures the assistant app's URL + intake token, pushes them to .env.local and Vercel (production + preview), and tests the integration end-to-end. Safe to re-run.
---

# Set Up AI Assistant Reports

Brings this project's "forward reports to the AI assistant app" integration to a fully-wired state:

1. **Template code present** — the synced forwarder (`src/server/template/issue-reporter/`) and its hooks in the bug-report / feature-request create handlers exist.
2. **Configured** — `AI_ASSISTANT_REPORTS_URL` + `AI_ASSISTANT_REPORTS_TOKEN` set in `.env.local` AND on Vercel (production + preview).
3. **Verified** — a live POST to the assistant app's intake endpoint returns `200 { ok: true, taskId }`, and the user confirms the task appeared in the assistant app's project.

When configured, every **user-submitted bug report** and **feature request** in this app is forwarded server-side to the assistant app, where it becomes a task in the bound project. The integration is opt-in: with either env var missing the forwarder silently no-ops, so leaving it unconfigured is harmless.

**Run this conversationally.** Each step has a verify gate — don't advance until it passes. **It is safe to re-run** — every step detects existing state first.

> Security: the intake token is a secret. It is used **server-side only** (the forwarder lives under `src/server/template/**`, which the import-boundary rule keeps out of client code). Never expose it with a `NEXT_PUBLIC_` prefix or in client code.

---

## What this skill does NOT do

- **It does not set up the receiver.** The assistant app (the one that owns `/api/intake/report`) and its per-project intake tokens are configured there, in that app's project **Settings → Intake tokens**. This skill only wires *this* project to send.
- **It does not change which reports are forwarded.** Only user-submitted bugs (`type: 'bug'` with a description) and feature requests are forwarded — automatic error reports are intentionally excluded to avoid flooding the assistant with noise.

---

## Step 0 — Pre-flight

```bash
test -f .vercel/project.json || echo "NOT LINKED"
node -p "require('./package.json').name"
```

If Vercel isn't linked, run `vercel link` and walk the user through it. Re-check before continuing — pushing env vars without a link fails silently.

---

## Step 1 — Confirm the template code is present

This integration ships in template-synced paths. If a project hasn't synced recently the code may be missing — verify before configuring anything.

```bash
# The forwarder util
test -f src/server/template/issue-reporter/index.ts && echo "OK util" || echo "MISSING util"
# The two handler hooks
grep -q "forwardBugReportToAssistant" src/apis/template/reports/handlers/createReport.ts && echo "OK reports hook" || echo "MISSING reports hook"
grep -q "forwardFeatureRequestToAssistant" src/apis/template/feature-requests/handlers/createFeatureRequest.ts && echo "OK feature hook" || echo "MISSING feature hook"
```

All three must print `OK`. If any are `MISSING`, the project needs a template sync first (`/sync-template`) — stop and tell the user. Do not hand-write the template code in a child project.

---

## Step 2 — Generate a token in the assistant app

**Goal:** the user has both env-var lines, copied from the assistant app.

In the **assistant app** (the receiver), the user:

1. Opens the project that should receive *this* app's reports.
2. Opens **Settings** → the **Intake tokens** section.
3. Enters a label (e.g. this project's name) and clicks **Generate**.
4. Clicks **Copy env vars** — this copies BOTH lines at once (the token is shown only once):
   ```
   AI_ASSISTANT_REPORTS_URL=https://<assistant-app>
   AI_ASSISTANT_REPORTS_TOKEN=intk_…
   ```

The URL is the assistant app's **stable** base URL — resolved server-side from `NEXT_PUBLIC_APP_URL` / Vercel's production URL, not from the browser's address bar. So it's correct regardless of which host the admin is viewing, **as long as the assistant app is deployed (or has `NEXT_PUBLIC_APP_URL` set)**. Caveat: if the admin generates the token while viewing the assistant app on `localhost`, the URL line will be `http://localhost:…` — fine for local testing only. For a **deployed** child, generate the token against the **deployed** assistant app.

Have the user paste both lines here. If they can't generate one, they need it from whoever owns the assistant app. Do not proceed without both.

---

## Step 3 — Write to `.env.local`

Paste the two copied lines into `.env.local`, replacing any existing `AI_ASSISTANT_REPORTS_*` lines (don't append duplicates). Then verify they're readable and sane:

```bash
URL=$(grep '^AI_ASSISTANT_REPORTS_URL=' .env.local | cut -d= -f2-)
TOKEN=$(grep '^AI_ASSISTANT_REPORTS_TOKEN=' .env.local | cut -d= -f2-)
echo "URL=$URL"
echo "TOKEN prefix=${TOKEN:0:13}…"
case "$URL" in
  *"/api/"*)          echo "⚠️  URL should be the ORIGIN only (no /api/... path)";;
  "")                 echo "⚠️  URL empty";;
  http://localhost*)  echo "⚠️  localhost URL — valid ONLY if this app also runs locally; not for a deployed child";;
  *)                  echo "URL shape OK";;
esac
case "$TOKEN" in intk_*) echo "TOKEN shape OK";; *) echo "⚠️  TOKEN should start with intk_";; esac
```

Both must look right before moving on. (A `*.vercel.app` URL is fine **only** if it's the assistant's stable production domain — never a per-deploy preview URL like `…-git-branch-….vercel.app`.)

---

## Step 4 — Test the integration (CRITICAL — do not skip)

POST a probe to the assistant app's intake endpoint using the exact env values the forwarder will use. This validates the URL + token together.

```bash
URL=$(grep '^AI_ASSISTANT_REPORTS_URL=' .env.local | cut -d= -f2-)
TOKEN=$(grep '^AI_ASSISTANT_REPORTS_TOKEN=' .env.local | cut -d= -f2-)
PROJECT=$(node -p "require('./package.json').name")
curl -s -w "\nHTTP %{http_code}\n" -X POST "${URL%/}/api/intake/report" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"bug\",\"title\":\"Integration test from ${PROJECT}\",\"description\":\"setup-ai-assistant-reports probe — safe to delete\",\"metadata\":{\"route\":\"/\",\"severity\":\"low\"}}"
```

Expect `HTTP 200` and `{"ok":true,"taskId":"…"}`.

Common failures:

| Response | Meaning | Fix |
|---|---|---|
| `HTTP 401 {"error":"Missing bearer token"}` | token didn't reach the server | check the `Authorization` header / token value |
| `HTTP 401 {"error":"Invalid or revoked token"}` | wrong/revoked token | regenerate in the assistant app (Step 2) |
| `HTTP 404 {"error":"Project not found"}` | the token's project was deleted | regenerate against a live project |
| connection error / wrong host HTML | `AI_ASSISTANT_REPORTS_URL` wrong | fix the base URL (origin only) |

**Then have the user confirm in the assistant app:** the task `[Bug] Integration test from <project>` appears in the bound project's Tasks. Have them **delete the probe task** once confirmed. Do not proceed until they've seen it.

---

## Step 5 — Push env vars to Vercel

```bash
URL=$(grep '^AI_ASSISTANT_REPORTS_URL=' .env.local | cut -d= -f2-)
TOKEN=$(grep '^AI_ASSISTANT_REPORTS_TOKEN=' .env.local | cut -d= -f2-)
yarn vercel-cli env:set --name AI_ASSISTANT_REPORTS_URL   --value "$URL"   --target production,preview
yarn vercel-cli env:set --name AI_ASSISTANT_REPORTS_TOKEN --value "$TOKEN" --target production,preview
```

(`env:set` uses the API and avoids the trailing-newline bugs `env:add`/piped input cause.)

---

## Step 6 — Redeploy

Env-var changes only apply to the **next** Vercel deployment. After Step 5:

```bash
yarn vercel-cli redeploy --message "chore: wire AI assistant reports env vars"
```

Skip only if both vars were already present and unchanged on Vercel.

---

## End-state contract

After this skill finishes:

- `src/server/template/issue-reporter/` and both handler hooks are present (synced).
- `AI_ASSISTANT_REPORTS_URL` + `AI_ASSISTANT_REPORTS_TOKEN` are set in `.env.local` and on Vercel (production + preview).
- A live POST to `${AI_ASSISTANT_REPORTS_URL}/api/intake/report` returns `200 { ok: true, taskId }` and the task was seen (and the probe deleted) in the assistant app.
- New user-submitted bug reports and feature requests in this app are forwarded into the assistant app's project as tasks.

---

## Quick checklist (agent ticks these off as you go)

- [ ] Vercel project linked
- [ ] Template code present (util + both handler hooks)
- [ ] Both env-var lines copied via **Copy env vars** in the assistant app's project Settings (token generated against the *deployed* assistant for a deployed child)
- [ ] `AI_ASSISTANT_REPORTS_URL` + `AI_ASSISTANT_REPORTS_TOKEN` in `.env.local`, shapes validated (not a localhost/preview URL for a deployed child)
- [ ] **Probe POST returned `HTTP 200 {ok:true}` AND user saw the task in the assistant app**
- [ ] Probe task deleted in the assistant app
- [ ] Both env vars set on Vercel (production + preview)
- [ ] Redeploy ran (only if vars were new/changed)
