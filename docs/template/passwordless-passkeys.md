---
title: Passwordless Passkeys (WebAuthn)
description: Passwordless auth with passkeys (WebAuthn / Face ID / Touch ID). Use this when enabling, testing, or migrating a project to passkey login, or wiring passkey enrollment.
summary: Opt-in passwordless auth behind the `AUTH_MODE` env flag (default `password`). Discoverable "just tap" login + self-service username-gated sign-up (account + first passkey, then admin approval) + a token-authenticated enrollment flow (now recovery / add-a-device) delivered by admin-generated links. Passkeys replace the credential, not the JWT session. Per-project cutover via the `/migrate-to-passkeys` skill. rpID must be a stable domain (NOT a Vercel preview URL).
priority: 2
---

# Passwordless Passkeys (WebAuthn)

Passwordless authentication using **passkeys** (WebAuthn): users sign in with
device biometrics — Face ID, Touch ID, or a device PIN — and no password is
ever created, stored, or leaked.

This is **opt-in per project** behind the `AUTH_MODE` env flag. A project that
has merged the passkey code but hasn't migrated keeps running password auth
unchanged.

## The key architectural insight

**Passkeys replace the _credential_, not the _session_.**

```
Password mode:  password  → bcrypt.compare        → issue JWT cookie
Passkey mode:   passkey assertion → verify signature → issue the SAME JWT cookie
```

Everything downstream of "issue JWT" is untouched: the preflight, instant-boot
hints, the Zustand auth store, `useUser()`, server `context.userId`, `isAdmin`,
admin-approved signups, route protection, and the MCP/SDK bearer path. See
[authentication.md](./authentication.md). Blast radius is contained to
credential storage, the login/enroll handlers, and a few client surfaces.

## The master switch: `AUTH_MODE`

| Env | Effect |
|---|---|
| `AUTH_MODE` unset / `password` | **Default.** Today's bcrypt password flow. |
| `AUTH_MODE=passkey` | Passkey-only auth. _Password_ sign-in / sign-up / change / reset are **disabled** (guarded by the flag). The login screen shows the passkey button plus a self-service "Sign up" toggle (passkey sign-up), gated by `authConfig.allowRegistration`. |

Because everything branches on the flag, the cutover is fully reversible:
`AUTH_MODE=password` + redeploy restores the password flow with no code change.

- Read server-side via `getAuthMode()` / `isPasskeyMode()`
  (`src/apis/template/auth/authMode.ts`).
- Surfaced to the client on the public preflight `/me` response (`authMode`),
  read with `useAuthMode()`. The login UI renders the passkey button only when
  `authMode === 'passkey'`.
- Env files are **never** touched by template sync, so the flag (and the
  password→passkey choice) survives every `/sync-template` with no
  `projectOverrides` bookkeeping.

## The three flows

> **Sign-up and approval are separate, unrelated steps.** Sign-up creates the
> account and registers the first device. Approval is a downstream admin action
> (`/admin/approvals`). Neither requires the other to be wired a certain way —
> the admin never has to hand out a link to *onboard* a user; they only approve.
> Enrollment links are now a **recovery / add-a-device** path, not the front door.

### 1. Daily login (discoverable / "just tap")

Server sends an empty `allowCredentials`, so the browser offers whatever
passkeys it holds for this site and the user taps one — no username typed.

```
LoginForm "Sign in with a passkey"
  → auth/passkey/login-options   (issues + stores a single-use challenge)
  → navigator.credentials.get()  (Face ID / Touch ID)
  → auth/passkey/login-verify    (verify assertion → issue JWT cookie)
```

`login-verify` runs the **same admin-approval gate** as password login and
returns a generic error on any failure (no passkey enumeration). 2FA is
intentionally skipped in passkey mode (a passkey is already possession +
biometric).

### 2. Self-service sign-up (username-gated, no link)

The passkey analogue of password sign-up. The **username is the gate** (must be
free) — no admin-issued token needed. It is fully decoupled from approval:
registering a device and being approved to log in are two independent things.

```
LoginForm "Sign up"  (passkey mode, authConfig.allowRegistration)
  → auth/passkey/signup/options   (username free? → create PENDING user → registration options)
  → navigator.credentials.create()  (Face ID / Touch ID)
  → auth/passkey/signup/verify    (verify → store first credential → approval gate)
        ├─ pending approval → { pendingApproval: true }  (no session → "Waiting for approval")
        └─ approved/bootstrap/admin → issue JWT cookie
```

These endpoints are **public** (no session, no token). Account-status logic
mirrors password `registerUser` exactly: `approvalStatus: 'pending'` unless
admin approval is disabled, the **first-user-wins** bootstrap applies, or the
`ADMIN_USER_ID` bypass matches. The owner is notified via Telegram on a new
pending sign-up (sent at *verify* time, once a real device is registered).

Resumable: if a user abandons the WebAuthn ceremony, their account is `pending`
with no credential. `signup/options` detects that exact state (pending + zero
credentials) and **reuses the same user** on retry instead of erroring
"Username already exists". A username that maps to a real account (has a
credential, or is approved) is rejected as taken; a `rejected` account surfaces
the rejection message. Trade-off: abandoned sign-ups leave credential-less
pending rows — they appear in `/admin/approvals` and can be rejected, or pruned
by a future cleanup job.

Because the endpoints are public and create rows + fire a Telegram message,
they are a light abuse surface (the approval gate means nobody actually gets in;
add rate-limiting if you expose this on a high-traffic public deployment).

### 3. Enrollment links (recovery / add-a-device)

A one-time **enrollment-link token** authorizes registering a passkey for an
**existing** user — used for recovery (lost device) and adding a device, plus
the password→passkey migration. The link is `${appUrl}/enroll-passkey?token=<raw>`.

Two delivery channels for the *same* link:

- **Admin-generated** (available now, no email): an admin opens **`/admin/users`**,
  clicks **Generate passkey link** for a user, and sends them the URL.
- **Email** (later, needs SES): `enroll/request` will email the same link.
  Deferred until email deliverability is verified — see "Deferred" below.

```
/enroll-passkey?token=…  (public, full-screen landing page)
  → auth/passkey/enroll/options  (validate token → registration options; token NOT consumed)
  → navigator.credentials.create()  (Face ID / Touch ID)
  → auth/passkey/enroll/verify   (verify → store credential → CONSUME token → issue JWT if approved)
```

The enroll endpoints are **public** — authorized by the token, not a session —
so a user with no passkey yet can register their first device. The token is
single-use, 1-hour TTL, and only the most recent link per user is valid
(generating a new one invalidates the old).

### Self-service enroll for logged-in users

A logged-in user can also add/rename/remove passkeys directly in
**Profile → Passkeys** (`auth/passkey/register-options` + `register-verify`,
`list`, `rename`, `delete`). This is session-gated and works in either mode, so
users can set up passkeys *before* a deployment cuts over.

## Backend map

| Piece | Path |
|---|---|
| Mode flag | `src/apis/template/auth/authMode.ts` |
| RP config (rpID/origin) | `src/server/template/webauthn/config.ts` |
| Ceremony wrappers | `src/server/template/webauthn/ceremonies.ts` |
| Credentials | `src/server/database/collections/template/credentials/` |
| Challenges (single-use, TTL) | `src/server/database/collections/template/webauthn-challenges/` |
| Enrollment tokens | `src/server/database/collections/template/enrollment-tokens/` |
| Passkey handlers | `src/apis/template/auth/handlers/passkey/` |
| Admin link generator | `src/apis/template/admin-users/handlers/generatePasskeyLink.ts` |

**Endpoints** (auth domain unless noted):
`passkey/register-options`, `register-verify`, `list`, `rename`, `delete`,
`login-options`, `login-verify`, `signup/options`, `signup/verify`,
`enroll/options`, `enroll/verify`, `step-up/options`, `step-up/verify`, and
`admin/users/generate-passkey-link` (admin-gated).

`signup/*` (self-service sign-up) and `enroll/*` (token recovery / add-device)
share the same registration ceremony and approval gate; they differ only in the
gate at the front — a free username vs. a one-time token — and `signup/*`
*creates* the user while `enroll/*` requires an existing one.

**Library:** `@simplewebauthn/server` (server) + `@simplewebauthn/browser`
(client). The server crypto never reaches the client bundle.

## Client surfaces

- `LoginForm` — "Sign in with a passkey" + a self-service "Sign up" toggle
  (passkey mode; sign-up shown when `authConfig.allowRegistration`). Reuses the
  shared `PendingApprovalScreen` for the awaiting-approval state.
- `Profile → Passkeys` (`PasskeysSection`) — add / rename / remove / list.
- `/admin/users` (`AdminUsers`) — list users + generate enroll (recovery) links.
- `/admin/approvals` — where new sign-ups are approved (separate from sign-up).
- `/enroll-passkey` (`EnrollPasskey`) — public landing page the recovery link opens.
- Hooks: `usePasskeyLogin`, `usePasskeySignup`, `usePasskeys`, `useAddPasskey`,
  `useRenamePasskey`, `useDeletePasskey`, `useAuthMode`, `browserSupportsPasskeys`.

## Guarding a sensitive page (step-up re-auth)

Gate any page or section behind a fresh passkey assertion — the user is already
logged in, but must confirm device possession (Face ID / Touch ID / device PIN)
before the content is revealed. Useful for billing, secrets, or any "are you
sure it's you" surface.

**Preferred — declare it on the route** (the router wraps the page for you, no
component needed):

```ts
// src/client/routes/index.project.ts
'/billing': { component: Billing, requirePasskey: true },
// or customize the lock screen:
'/billing': {
  component: Billing,
  requirePasskey: { title: 'Protected', description: 'Confirm to view.', ttlMs: 300000 },
},
```

`requirePasskey` is a `RouteConfig` option; the router exposes it via context
and `RoutePasskeyGuard` (mounted once in `_app.tsx`) wraps the active route.

**Or guard a section** with the component directly:

```tsx
import { PasskeyGuard } from '@/client/features';

<PasskeyGuard guardKey="billing" title="Protected" description="Confirm to view.">
  <SensitiveStuff />
</PasskeyGuard>
```

Both share the same behavior:
- A lock screen with an **Unlock with passkey** button; on failure it shows the
  error + a **Try again** button. On success the content renders and stays
  unlocked for `ttlMs` (default 5 min).
- Backed by real server-verified assertions (`auth/passkey/step-up/options` +
  `verify`, restricted to the user's own credentials) — a genuine WebAuthn
  proof, not a UI-only flag.
- Unlock state lives in an **in-memory** store (`usePasskeyGuardStore`, keyed by
  `guardKey`/route path) — never persisted, so it re-prompts after a reload/new
  tab. The hook `usePasskeyStepUp()` exposes the ceremony for fully custom UI.

**Security boundary:** this is a client-side UI gate over a real assertion — it
protects against someone using an already-unlocked session / shoulder-surfing.
It does **not** change the session, so if the underlying *data* must be
protected server-side, additionally gate the sensitive API(s). Works in any
`AUTH_MODE` as long as the user has a registered passkey.

Live demo: **`/sensitive`** (`SensitiveExample`, template project) — gated via
the route-level `requirePasskey`.

## Configuration & env

| Env | Purpose |
|---|---|
| `AUTH_MODE` | `password` (default) \| `passkey`. |
| `WEBAUTHN_RP_ID` | The **stable production domain** (host only, no scheme/port). Required in prod passkey mode. |
| `WEBAUTHN_ORIGIN` | Optional explicit origin override; defaults to `appConfig.appUrl`. |

- **Dev**: rpID is always `localhost`; any localhost port is accepted.
- **Prod**: rpID = `WEBAUTHN_RP_ID` (or `appConfig.appUrl` host).

### ⚠️ rpID must be a stable domain — NOT a Vercel preview URL

A passkey is cryptographically bound to its rpID (domain). Passkeys registered
on the production domain do **not** work on `*-git-*.vercel.app` preview URLs
(different host → the browser refuses the credential). Always test passkeys on
the real production domain. Dev (`localhost`) and prod (`WEBAUTHN_RP_ID`) are
separate, isolated credential namespaces — this is also why the dev localhost
origin allowance is not a production security concern (it's `NODE_ENV`-gated).

## Security model

- **Counter = 0 is normal** for synced platform authenticators (iCloud/Google) —
  never reject zero counters.
- **Enrollment links are bearer tokens** (like a password-reset link):
  single-use, 1-hour TTL, one active per user. Send over a channel you trust.
- **Approval gate honored** everywhere a session could be issued (login, sign-up, enroll).
- **Anti-enumeration**: login-verify returns a generic error for any failure.
- **Secure context** required: prod HTTPS ✅, localhost ✅, installed iOS PWA
  16.4+ ✅ (same constraint as web push).

## Per-project cutover — the `/migrate-to-passkeys` skill

Each project opts in by running the **`/migrate-to-passkeys`** skill, which:

1. Preflights the gating conditions (deps present; stable `WEBAUTHN_RP_ID`;
   not a preview URL; for email delivery later, SES verified).
2. Ensures every user has a way to enroll — generate admin links from
   `/admin/users` (or, later, email) and have users register a device.
3. Flips `AUTH_MODE=passkey` (`.env.local` + Vercel) and redeploys.
4. Verifies real enroll + "just tap" login end-to-end on the prod domain.

**Passwords work as a bridge only *until* the flip.** Flipping
`AUTH_MODE=passkey` retires the password handlers (login / sign-up / change /
reset all refuse) — so enroll users *before* flipping. There is no password
fallback afterward; the backstop is the admin re-issuing an enroll link, and
rollback is `AUTH_MODE=password` + redeploy.

## Status / deferred

- ✅ Built & production-verified: mode flag, discoverable login, self-service
  enroll/rename/delete, the token-enroll flow, admin-generated links,
  the `/admin/users` page, the `/enroll-passkey` landing page.
- ✅ **Self-service passkey sign-up:** username-gated `signup/options` +
  `signup/verify`, decoupled from approval (new users land in `/admin/approvals`
  exactly like password sign-up). Shown in `LoginForm` behind
  `authConfig.allowRegistration`. Enrollment links are repositioned as recovery /
  add-a-device. (Email-delivered self-service is still the SES item below.)
- ✅ **Phase 6 — password retirement (guarded):** in passkey mode the password
  login/sign-up/change/reset endpoints refuse, and the login UI is passkey-only
  (the Profile password row is hidden). Reversible via `AUTH_MODE=password`.
- ✅ **RPC connection device-auth:** in passkey mode, opening an RPC connection
  requires a passkey assertion on a registered device (replacing the Telegram
  admin approval), via `connect-options`/`connect-verify`. See
  [rpc-connection-gate.md](./rpc-connection-gate.md).
- ⛔ **Deferred (needs SES):** `enroll/request` — emailing the enroll link so
  **recovery / add-a-device** self-serves instead of going through an admin
  (sign-up itself already self-serves via `signup/*`). The link and ceremony are
  identical; only the delivery channel is missing. Email lives in
  `src/server/template/email` (AWS SES via `TWO_FACTOR_EMAIL_FROM` + AWS creds);
  verify deliverability before enabling.
