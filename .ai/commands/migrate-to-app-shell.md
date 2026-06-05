---
description: Migrate a child project's src/pages/_app.tsx to the thin-shim + template-owned <AppShell> pattern. Run after a template sync brings in src/client/features/template/app-shell. Preserves project-specific providers via the wrapProviders prop. Idempotent — no-ops if already migrated.
---

# Migrate to App Shell

Converts a child project's project-owned `src/pages/_app.tsx` into a **thin shim**
that renders the template-owned **`<AppShell>`**. After this, the whole app-root
tree (providers, router, boot gating, offline init, app-root bridges) is
template-owned and synced, so future template features that mount at app root —
e.g. push deep-link navigation — work end-to-end with **no further `_app.tsx`
edits**.

Read **[docs/template/app-shell.md](../../docs/template/app-shell.md)** first.

**Run this conversationally. Each step has a verify gate — do not advance until
it passes.** `_app.tsx` is project-owned and not overwritten by sync, so a wrong
edit here is on us — be conservative and confirm the mapping before writing.

> 🔒 The only file this skill rewrites is `src/pages/_app.tsx`. It must NOT touch
> template-owned files (`src/client/features/template/app-shell/**`). If those
> look wrong, the fix is a template sync, not an edit here.

---

## Step 0 — Preflight (gating)

Verify ALL of the following before changing anything:

1. **`<AppShell>` has synced in.** Confirm these exist:
   - `src/client/features/template/app-shell/AppShell.tsx`
   - `src/client/features/template/app-shell/TemplateAppBridges.tsx`
   - `src/client/features/template/app-shell/index.ts` (exports `AppShell`)

   If missing, the project hasn't synced the app-shell code yet — run
   `/sync-template` first and stop.

2. **Already migrated? (idempotency).** Read `src/pages/_app.tsx`. If it already
   imports `AppShell` from `@/client/features/template/app-shell` and its default
   export just renders `<AppShell … />`, there is nothing to do — tell the
   developer it's already on the shim and stop. (This is the expected state in
   the template repo itself.)

3. **Working tree is clean** (or changes are committed), so the rewrite is easy
   to review/revert: `git status --short`.

**Verify gate:** AppShell files exist, `_app.tsx` is NOT yet a shim, tree is
clean. State what you found and proceed.

---

## Step 1 — Classify the current `_app.tsx`

Read `src/pages/_app.tsx` in full and bucket every line into one of:

**(A) Standard template tree** — owned by `<AppShell>` now, safe to drop:
`<Head>` viewport meta, `QueryProvider`, `AppThemeProvider`, `RouterProvider
routes={routes}` + its render-prop, `AuthWrapper`, `Layout`,
`RoutePasskeyGuard`, `BatchSyncAlert`, a local `BootGate`, a local
`AppInitializer` (offline listeners + `initializeApiClient` +
`useOfflineSyncInitializer`), the module-level `markEvent(BOOT_PHASES.APP_MOUNT)`,
the `dynamic(... Router ...)` import, and the `auth/preflight` side-effect import.
All of this is reproduced verbatim inside `<AppShell>` — do not carry it over.

**(B) Global CSS imports** — MUST stay in the shim. Next.js only allows global
(non-module) CSS imports from `_app`. Typically `@/client/styles/globals.css`
and `@/client/styles/project.css`, plus any project CSS the child added. Keep
ALL of them, in order.

**(C) Project-specific additions** — must be preserved. Look hard for these:
   - Extra **context providers** wrapping the tree (analytics, i18n, a project
     store provider, a feature-flag provider, etc.).
   - Extra **components / bridges** mounted alongside the template tree.
   - Project-specific **init** (effects, side-effect imports, telemetry).
   - Anything else not in bucket (A) or (B).

Produce a short written inventory of buckets (B) and (C) and show it to the
developer. **If bucket (C) is empty**, this is a clean swap. **If not**, you'll
map each (C) item in Step 2.

**Verify gate:** developer agrees with your bucket (C) inventory (the things that
must be preserved). Do not write anything until they confirm.

---

## Step 2 — Write the shim

### Clean case (bucket C empty)

```tsx
import "@/client/styles/globals.css";
import "@/client/styles/project.css";  // + any other project global CSS, in order
import { AppShell } from "@/client/features/template/app-shell";

export default function App() {
  return <AppShell />;
}
```

### With project providers (bucket C)

`<AppShell>` exposes a `wrapProviders` prop: `(children: ReactNode) => ReactNode`.
It wraps the **router subtree**, running inside Query + Theme context and after
store hydration. Move project **context providers** there:

```tsx
import "@/client/styles/globals.css";
import "@/client/styles/project.css";
import { AppShell } from "@/client/features/template/app-shell";
import { MyProjectProvider } from "@/client/features/project/...";

export default function App() {
  return (
    <AppShell
      wrapProviders={(children) => (
        <MyProjectProvider>{children}</MyProjectProvider>
        // nest multiple providers as needed
      )}
    />
  );
}
```

**Mapping rules:**
- **Context providers** that wrap the tree → nest inside `wrapProviders`. Routes
  rendered by the router are their children, so route components still get the
  context. ✅
- **Project side-effect imports / module-level init** → keep at the top of the
  shim (they run on module load, same as before). ✅
- ⚠️ **A project *bridge* (a sibling component, not a wrapper) that itself calls
  `useRouter()`** cannot go in `wrapProviders` — that subtree renders *outside*
  `<RouterProvider>`. Two options: (a) if it doesn't truly need router context,
  wrap it as a provider/fragment in `wrapProviders`; (b) if it genuinely needs
  router context, it belongs next to the template bridges — the clean answer is
  to contribute it to the template's `<TemplateAppBridges>` (via
  `/contribute-to-template`), OR keep a hand-rolled `_app.tsx` for now and skip
  this skill. **Surface this to the developer and let them choose — do not guess.**
- **Per-route visual wrappers** (something that must wrap `<RouteComponent/>`
  inside `<Layout>`) have no seam in `<AppShell>` today. Flag it; same choice as
  above.

Write the new `src/pages/_app.tsx`. Then show the developer the full diff
(`git diff src/pages/_app.tsx`) and the mapping of each bucket-(C) item.

**Verify gate:** developer approves the diff.

---

## Step 3 — Verify

1. `yarn checks` — TypeScript, ESLint, **circular deps** (the import direction
   matters here), and unused deps must all pass.
2. Boot the app (`yarn dev` if not already running) and load `/` — confirm HTTP
   200 and no compile-error overlay. Spot-check that any preserved project
   provider still works (the feature that depended on it renders).

**Verify gate:** `yarn checks` is green and the app boots clean.

---

## Step 4 — Smoke-test the payoff (optional but recommended)

The reason for this migration is that app-root bridges now stay wired. Confirm
the canonical one — push deep-link navigation — still works:

```bash
yarn test-push <userId> "App shell migration" "Tap me" /settings
```

Tap the notification → the app should navigate to `/settings`
(`<PushNavigationBridge>`, mounted by `<AppShell>` via `<TemplateAppBridges>`,
handles it). See [docs/template/ios-pwa-notifications.md](../../docs/template/ios-pwa-notifications.md).
(Requires push to be set up — VAPID env + a registered device. Skip if not.)

**Verify gate:** tap navigates correctly, OR push isn't configured (acceptable to
skip).

---

## Step 5 — Wrap up

- Tell the developer `_app.tsx` is now a thin shim over the template-owned
  `<AppShell>`. Future template app-root bridges arrive via sync with no
  `_app.tsx` change.
- If any bucket-(C) item was deferred (a router-context bridge or per-route
  wrapper with no seam), state it clearly as the one remaining follow-up.
- Commit on a branch (don't commit straight to the default branch).

---

## Notes / gotchas

- **Global CSS only in `_app`.** Never move `globals.css` / `project.css` imports
  into `AppShell` — Next.js rejects global CSS imported outside `_app`.
- **`wrapProviders` wraps the router subtree** (inside Query + Theme, around
  `<RouterProvider>`). Good for context providers; not for components needing
  router context themselves.
- **Don't edit the template files.** `AppShell` / `TemplateAppBridges` are
  template-owned (`src/client/features/template/app-shell/**`) and synced. If
  they need to change, do it via `/contribute-to-template`, not here.
- **Idempotent.** Re-running after migration is a no-op (Step 0.2 catches it).
- **Behavior must be unchanged.** The shim renders the exact same tree `<AppShell>`
  reproduces; if something looks different after migrating, a bucket-(C) item was
  missed — re-inspect the pre-migration `_app.tsx` via `git show`.
