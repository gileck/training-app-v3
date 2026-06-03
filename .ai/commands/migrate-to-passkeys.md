---
description: Migrate a child project from password auth to passwordless passkeys (WebAuthn). Per-project cutover — picks WEBAUTHN_RP_ID, enrolls users via admin links, flips AUTH_MODE=passkey, and verifies end-to-end. Passwords stay as a bridge.
---

# Migrate to Passkeys (Per-Project Cutover)

Cuts a child project over from password auth to passwordless **passkeys
(WebAuthn)**. The passkey system itself ships with the template (behind the
`AUTH_MODE` flag, default `password`); this skill performs the per-project
flip and verification.

Read **[docs/template/passwordless-passkeys.md](../../docs/template/passwordless-passkeys.md)**
first. The core idea: **passkeys replace the credential, not the JWT session** —
so the cutover is mostly env config + getting users enrolled, not a rewrite.

**Run this conversationally. Each step has a verify gate — do not advance until
it passes.** Passwords keep working as a bridge **only until the flip in Step 3** —
flipping `AUTH_MODE=passkey` *disables* password login/sign-up/reset (Phase 6).
So enroll users **before** flipping. Rollback is always `AUTH_MODE=password` +
redeploy.

> 🔒 **Security:** you (the agent) must NEVER enter secrets. `AUTH_MODE` and
> `WEBAUTHN_RP_ID` are **non-secret config** — you may set them with
> `yarn vercel-cli env:set`. Never touch API keys, DB URIs, or passwords; the
> developer owns those.

---

## Step 0 — Preflight (gating)

Verify ALL of the following before changing anything:

1. **This is a child project, not the template repo.** (Check `package.json`
   name / `.template-sync` config.)
2. **Deps present:** `@simplewebauthn/server` and `@simplewebauthn/browser` in
   `package.json`. If missing, the project hasn't synced the passkey code yet —
   run `/sync-template` first.
3. **`AUTH_MODE` is currently unset or `password`** (don't re-migrate).
4. **A stable production domain exists** for `WEBAUTHN_RP_ID` — the real prod
   host (e.g. `myapp.com` or `myapp.vercel.app`), **NOT** a `*-git-*.vercel.app`
   preview URL. Confirm it with the developer. Get it from Vercel:
   `yarn vercel-cli env` (look for `VERCEL_PROJECT_PRODUCTION_URL` /
   `NEXT_PUBLIC_APP_URL`).

**Verify gate:** state the chosen `WEBAUTHN_RP_ID` host back to the developer
and get a clear yes before continuing.

---

## Step 1 — Set `WEBAUTHN_RP_ID` on production

```bash
yarn vercel-cli env:set --name WEBAUTHN_RP_ID --value <prod-domain-host> --target production
```

(Host only — no `https://`, no trailing slash, no path.)

**Verify gate:** `yarn vercel-cli env | grep WEBAUTHN_RP_ID` shows it set for
production.

---

## Step 2 — Enrollment window (get users onto passkeys)

Passkeys must exist BEFORE login depends on them. While still in password mode:

1. Make sure the current production build includes the passkey code (merge to
   the production branch + deploy if not already — verify with
   `curl -s -X POST https://<domain>/api/process/auth_me -H 'content-type: application/json' -d '{"params":{}}'`
   and confirm the response includes an `authMode` field).
2. Go to **`/admin/users`** on the prod domain → **Generate passkey link** for
   each user → send them the link. Each user opens it and registers a device
   (Face ID / Touch ID). The admin should enroll their **own** device first.
   - (When SES email is wired, this becomes self-service email links instead —
     same link, different delivery. Until then, admin links are the channel.)

**Verify gate:** at minimum the **admin** has a registered passkey — confirm a
non-zero passkey count for the admin in `/admin/users`. Ideally most/all active
users are enrolled before flipping. (Passwords remain a fallback, so stragglers
aren't locked out.)

---

## Step 3 — Flip `AUTH_MODE=passkey`

Set it locally and on production:

```bash
# Local (.env.local — gitignored; you may edit this file directly)
AUTH_MODE=passkey

# Production
yarn vercel-cli env:set --name AUTH_MODE --value passkey --target production
```

Then redeploy production (merge to the production branch + push, or
`yarn vercel-cli redeploy` on the production branch).

**Verify gate:** after the deploy is Ready, an unauthenticated
`curl … /api/process/auth_me` against the prod domain returns
`"authMode": "passkey"`.

---

## Step 4 — Verify end-to-end (on the real prod domain)

On `https://<WEBAUTHN_RP_ID>` (NOT a preview URL):

1. Log out → the login screen shows **"Sign in with a passkey"**.
2. Tap it → pick your passkey → Face ID / Touch ID → you land signed in.
3. Confirm the issued session behaves exactly like before (instant boot,
   `useUser()`, admin pages, etc. — passkeys only changed the front door).
4. **Password login is now disabled** (the login screen is passkey-only). Anyone
   not yet enrolled needs an admin-issued enroll link from `/admin/users`. If
   coverage turns out too low, roll back: `AUTH_MODE=password` + redeploy.

**Verify gate:** a real "just tap" passkey login succeeds on the prod domain
and `yarn checks` is green.

---

## Step 5 — Wrap up

- Tell the developer the project is now in **passkey mode** — password login is
  retired (Phase 6); new users/devices come in via enrollment links.
- Note the one remaining **deferred** follow-up (needs SES, NOT part of this
  skill): **email enrollment** (`enroll/request`) — lets signup/recovery
  self-serve via emailed links instead of admin-generated ones.

---

## Notes / gotchas

- **rpID = stable domain.** Passkeys do not carry across preview URLs. If a
  user reports "passkey not offered", check they're on `WEBAUTHN_RP_ID`, not a
  preview deployment.
- **Lost device + no other passkey + not yet self-serve recovery** → the admin
  re-issues an enroll link from `/admin/users` (the admin-assisted backstop).
- **Don't retire passwords prematurely** — keep them until enrollment coverage
  is high; the flag makes rollback trivial (`AUTH_MODE=password` + redeploy).
