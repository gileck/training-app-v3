---
title: iOS PWA Push Notifications
description: Web Push notifications for installed PWAs on iOS, Android, and desktop. Use this when adding user-facing push notifications.
summary: Web Push (VAPID) subscriptions. iOS works only from a home-screen-installed PWA on iOS 16.4+. Server uses `sendPushToUser(userId, payload)`; dead endpoints are auto-pruned on 404/410. Run `yarn generate-vapid` once to create keys.
priority: 3
---

# iOS PWA Push Notifications

The app supports standards-compliant **Web Push** notifications via VAPID. This
works on Chrome / Firefox / Edge on desktop + Android, and on **iOS 16.4+ when
the app is installed as a PWA** ("Add to Home Screen").

## Architecture

### Subscribe flow

```
client (Settings toggle)
  │  user gesture → Notification.requestPermission()
  │  PushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })
  ▼
POST /api/process/push-notifications/subscribe
  └─▶ MongoDB: push_subscriptions { userId, endpoint, keys, platform }
```

### Send flow

```
server feature code
  └─▶ sendPushToUser(userId, { title, body, url })
        └─▶ web-push → Apple / FCM / Mozilla push service
              └─▶ device receives push → sw-push.js `push` event
                    └─▶ showNotification(title, { body, data: { url } })
```

### Tap → SPA navigation flow

```
user taps notification → sw-push.js `notificationclick`
  ├─ if a same-origin client window exists:
  │    client.focus() + client.postMessage({ type:'push-navigate', url })
  │       └─▶ <PushNavigationBridge> in _app.tsx receives the message
  │             └─▶ useRouter().navigate(url)   ← real SPA transition
  │
  └─ else:
       clients.openWindow(url)
          └─▶ React mounts, router reads window.location.pathname
```

> **Why the postMessage detour?** `WindowClient.navigate(url)` is unreliable on
> iOS PWAs and also wouldn't work under our Next.js SPA rewrite (every non-API
> path rewrites to `/`). Going through the in-app router is the only way to
> get a proper client-side transition.

## Per-project setup

Follow these steps exactly once per child project. Everything else (service
worker wiring, APIs, Settings toggle) already ships from the template — you
only need to provision VAPID keys and make them available to the deployment.

### 1. Generate a VAPID keypair (once, per project)

```bash
yarn generate-vapid
```

Each project needs its **own** keypair. Do **not** reuse keys between projects
— subscriptions are bound to the public key, so sharing keys would cross-wire
notifications between apps. Once generated, never rotate unless you accept
that every existing user must re-enable notifications.

The command prints three values:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
VAPID_SUBJECT=mailto:you@example.com
```

Use a real contact address for `VAPID_SUBJECT` (`mailto:` or `https://`). Push
services may use it to reach you about abuse or policy issues.

### 2. Write them to `.env.local` (local dev)

Append the three lines to `.env.local`. It's git-ignored (`.gitignore` matches
`.env*.local`), so the private key stays off git. Restart any running `yarn
dev` so Next.js picks up the new vars.

> `.env.example` already lists these three keys with blank values — keep it
> that way as a template for other developers; never commit real values there.

### 3. Push the three vars to Vercel

Link the project first if you haven't already:

```bash
vercel link
```

Then set each variable across **all three targets** (production, preview,
development). Use the template CLI — it uses the Vercel API directly so there
are no piped-input / trailing-newline issues:

```bash
yarn vercel-cli env:set --name NEXT_PUBLIC_VAPID_PUBLIC_KEY --value "<public>"
yarn vercel-cli env:set --name VAPID_PRIVATE_KEY            --value "<private>"
yarn vercel-cli env:set --name VAPID_SUBJECT                --value "mailto:you@example.com"
```

By default `--target` is `production,preview,development` — that's what you
want. **Never** use `npx vercel env add` with piped input (see
`docs/template/project-guidelines/vercel-cli-usage.md`).

Verify:

```bash
yarn vercel-cli env | grep VAPID
# expect 9 rows (3 vars × 3 targets)
```

### 4. Redeploy

Env-var changes don't apply to existing deployments. Trigger a new build:

```bash
yarn vercel-cli redeploy     # or push any commit
```

### 5. Smoke-test the deployment

- **Desktop browser (preview URL):** log in → Settings → Notifications → flip
  toggle → accept prompt → click **Send test**.
- **iOS device (preview URL):** Safari → Share → **Add to Home Screen** →
  launch from the home-screen icon → Settings → Notifications → flip toggle
  → **Send test**. Lock the screen and fire another test to confirm lock-screen
  delivery.

If the toggle is disabled and reads "Push notifications are not configured",
the server's `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is missing — re-check step 3 and
redeploy.

### 6. Hook notifications into your features

No global opt-in is needed — as soon as the env vars are set, any server code
can call `sendPushToUser(userId, payload)`. See
[Sending notifications from server code](#sending-notifications-from-server-code)
below.

### Optional: customize the Settings section UI

The toggle lives at
`src/client/routes/template/Settings/components/NotificationsSection.tsx`.
That file is template-owned; to customize copy or placement for a child
project, override it via `projectOverrides` or move the
`PushNotificationToggle` import into a project-owned route.

### Optional: tune the notification icons

The `push` handler in `public/sw-push.js` defaults `icon` to
`/icons/icon-192x192.png` and `badge` to `/icons/icon-96x96.png`. If your
child project ships different icons, either update those paths in
`sw-push.js` (project-override it) or pass `icon` / `badge` per-notification
from `sendPushToUser(...)`.

## Legacy one-liner (for quick local testing only)

1. `yarn generate-vapid`
2. Paste output into `.env.local`
3. `yarn build && yarn start` (push is **disabled in `yarn dev`** —
   `pwaConfig.disable: NODE_ENV === 'development'` in
   `config/next/next.template.ts`)
4. Settings → Notifications → **Send test**

## Sending notifications from server code

`sendPushToUser(userId, payload)` is the single entry point. Import it from any
server file — API handler, cron job, agent, workflow hook, anywhere.

```ts
import { sendPushToUser } from '@/server/template/push';

await sendPushToUser(userId, {
    title: 'New message',
    body: 'You have a new message from Alice.',
    url: '/messages/abc',    // where tapping the notification should navigate
    tag: 'message-abc',      // optional: replaces prior notifications w/ same tag
});
```

### Return shape

```ts
type PushSendResult = {
    endpoint: string;        // the push service URL
    success: boolean;        // true if delivery accepted
    removed: boolean;        // true if the subscription was deleted (404/410)
    statusCode?: number;     // HTTP status from the push service
    error?: string;          // delivery error message (if any)
};
```

The function never throws for delivery failures. It only throws once, up-front,
if VAPID env vars are missing. If the user has no subscriptions the call is a
no-op and returns `[]`.

### Fire-and-forget from API handlers

Don't block the API response on push delivery. Use `void` so unhandled errors
don't crash the process:

```ts
// src/apis/.../handlers/createComment.ts
import { sendPushToUser } from '@/server/template/push';

export const createCommentHandler = async (req, context) => {
    const comment = await comments.insert(/* … */);

    void sendPushToUser(post.authorId, {
        title: 'New comment',
        body: `${author.username}: ${preview(comment.text)}`,
        url: `/posts/${post._id}#c-${comment._id}`,
        tag: `comment-${post._id}`,
    }).catch((err) => console.error('[push] delivery failed:', err));

    return { comment };
};
```

### Pre-checking configuration

If push is optional for your feature, guard the call so you don't throw when
VAPID keys aren't set in a given environment:

```ts
import { isPushConfigured, sendPushToUser } from '@/server/template/push';

if (isPushConfigured()) {
    void sendPushToUser(userId, payload);
}
```

### Broadcasting to many users

There is no built-in `sendPushToAll`. For bulk sends, loop with a concurrency
cap so you don't flood the push service or Mongo:

```ts
import pLimit from 'p-limit'; // or any small limiter
const limit = pLimit(10);
await Promise.all(
    userIds.map((id) => limit(() => sendPushToUser(id, payload))),
);
```

### Testing from the CLI

The fastest way to fire a real push during development is `yarn test-push`.
It calls `sendPushToUser()` directly against whichever Mongo your `.env.local`
points at — point at the production Mongo to push to a real device.

```bash
yarn test-push                                          # ADMIN_USER_ID, default copy
yarn test-push <userId>
yarn test-push <userId> "Title" "Body"
yarn test-push <userId> "Title" "Body" /todos/abc123    # deep link
```

Useful for verifying lock-screen / closed-app delivery and for testing deep
links without going through the Settings UI.

### Admin test endpoint (HTTP)

For ad-hoc testing without shell access, call
`admin/push-notifications/sendTest` with `{ userId, title?, body?, url? }`.
It pushes to every device that user has registered and returns
`{ sent, removed }`. Admin-only — `context.isAdmin` must be true.

### Payload tips

- Keep under ~4KB (iOS APNs limit). Put large data behind the `url`.
- `tag` coalesces notifications — a new "unread messages" push with the same
  tag replaces the previous one instead of stacking.
- `url` is what `notificationclick` in `public/sw-push.js` focuses or opens.
- `icon` / `badge` default to your PWA icons — only override for per-notification art.

## iOS constraints — important

- **Only works in the installed PWA.** Safari tabs cannot subscribe on iOS.
- **Requires iOS / iPadOS 16.4 or newer.**
- **Permission must come from a user gesture.** The toggle calls
  `Notification.requestPermission()` synchronously at the top of its click
  handler — do not insert awaits before that call.
- **`navigator.standalone`** detection is used to decide whether to show the
  "Add to Home Screen" hint vs. the live toggle.

## Files

- `public/sw-push.js` — service worker `push` + `notificationclick` handlers
  (imported into the next-pwa-generated `sw.js`). Sends `push-navigate`
  messages to focused clients instead of using `WindowClient.navigate()`.
- `src/server/template/push/sendPush.ts` — server sender, VAPID setup,
  automatic pruning of dead endpoints.
- `src/server/database/collections/template/push-subscriptions/` —
  MongoDB collection (`push_subscriptions`, unique index on `endpoint`).
- `src/apis/template/push-notifications/` — `subscribe`, `unsubscribe`,
  `status`, `sendTest` (self) + `admin/sendTest`.
- `src/client/features/template/push-notifications/` — client feature:
  - `PushNotificationToggle` + `useSubscribePush` / `useUnsubscribePush` /
    `useSendTestPush` hooks for the Settings UI.
  - `PushNavigationBridge` — null-rendering component that listens for
    `push-navigate` messages from the SW and calls the app router. Mounted
    inside `<RouterProvider>` in `src/pages/_app.tsx`.
- `scripts/template/test-push.ts` — `yarn test-push` CLI for sending ad-hoc
  pushes from the terminal during development.
- `scripts/template/generate-vapid.ts` — `yarn generate-vapid` CLI for
  creating a VAPID keypair.

## Troubleshooting

- **Toggle is disabled on iOS:** user is in Safari, not the installed PWA.
  The inline hint explains this.
- **`status` returns `configured: false`:** VAPID env vars are missing on the
  server.
- **Test sent but nothing received:** check the browser's notification
  permission — it may be blocked at the OS level (System Settings → Notifications).
- **Subscription disappears after a few days:** expected; devices rotate keys.
  Subscribing again is idempotent (the `endpoint` unique index upserts).
- **Tap on notification opens the app but doesn't navigate:** check that
  `<PushNavigationBridge />` is mounted inside `<RouterProvider>` in
  `_app.tsx`. Without it, the SW posts `push-navigate` messages to the
  client but nothing handles them. (`WindowClient.navigate()` won't save
  you here — it's unreliable on iOS and breaks under SPA path rewrites.)
