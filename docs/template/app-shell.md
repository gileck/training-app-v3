---
title: App Shell
description: Template-owned application root that owns the full provider/bridge tree. Use this when adding app-root wiring (providers, bridges) or wondering why _app.tsx is a thin shim.
summary: The entire provider/boot tree (Query, Theme, Router, Auth, Layout, hydration gating, offline + API-client init, app-root bridges) lives in the template-owned <AppShell>. Child `src/pages/_app.tsx` is a thin shim that renders <AppShell/> and imports global CSS. Template features needing app-root mounting (e.g. push deep-link navigation) are wired via <TemplateAppBridges> and work end-to-end in every child with no _app.tsx changes. Project-wide providers attach via the `wrapProviders` prop. Existing projects migrate with the `/migrate-to-app-shell` skill.
priority: 3
---

# App Shell

`src/pages/_app.tsx` is **project-owned** (not synced by template-sync). To stop
every template feature that needs app-root wiring from requiring a manual
`_app.tsx` edit in each child, the entire application root lives in the
template-owned **`<AppShell>`** at
`src/client/features/template/app-shell/`.

## The thin shim

A child project's `_app.tsx` is just:

```tsx
import "@/client/styles/globals.css";
import "@/client/styles/project.css";
import { AppShell } from "@/client/features/template/app-shell";

export default function App() {
  return <AppShell />;
}
```

Global CSS stays here because Next.js only allows global stylesheet imports from
`_app`. Everything else — `QueryProvider`, `AppThemeProvider`, `RouterProvider`,
`AuthWrapper`, `Layout`, `RoutePasskeyGuard`, boot/hydration gating
(`BootGate`), offline + API-client init (`AppInitializer`), and app-root bridges
(`TemplateAppBridges`) — is owned by `<AppShell>` and synced.

## Adding an app-root bridge (the common case)

A "bridge" is a null-rendering component that needs router/auth context but no
visible UI (e.g. `PushNavigationBridge` for push deep links). Add it to
**`TemplateAppBridges.tsx`**:

```tsx
export function TemplateAppBridges(): ReactElement {
  return (
    <>
      <PushNavigationBridge />
      <MyNewBridge />   {/* picked up by every child on next template sync */}
    </>
  );
}
```

Because `TemplateAppBridges` is mounted by `<AppShell>` and both are
template-owned, the new bridge reaches every child with **no `_app.tsx`
change**. This is the whole point of the shell.

`TemplateAppBridges` renders inside `<RouterProvider>` and `<AuthWrapper>`, so a
bridge there has Query + Theme + Router + Auth context available.

## Project extension: custom providers

To wrap all routes with project-specific context providers, pass `wrapProviders`
from the shim. It receives the router subtree and must return it wrapped; it
renders inside Query + Theme context and after store hydration:

```tsx
export default function App() {
  return (
    <AppShell
      wrapProviders={(children) => (
        <MyProjectProvider>{children}</MyProjectProvider>
      )}
    />
  );
}
```

The seam is a **prop, not an import**, on purpose: `AppShell` never depends on a
project symbol, so it compiles cleanly in every synced child.

## Import / cycle note

`AppShell` is intentionally **not** re-exported from the `@/client/features`
barrel. It imports `@/client/routes`, and routing back through the barrel would
form a `barrel → app-shell → routes → route-components → barrel` import cycle
that `yarn checks` flags. Import it directly:

```ts
import { AppShell } from '@/client/features/template/app-shell';
```

For the same reason, `AppShell` imports each provider from its specific feature
module (`../auth`, `../settings`, `../offline-sync`, `../boot-performance`)
rather than the barrel.

## Files

- `src/client/features/template/app-shell/AppShell.tsx` — the root tree,
  `BootGate`, `AppInitializer`, the `wrapProviders` seam, and the module-level
  boot side effects (`markEvent(APP_MOUNT)`, `auth/preflight` import).
- `src/client/features/template/app-shell/TemplateAppBridges.tsx` — aggregator
  for app-root bridges; add new template bridges here.
- `src/client/features/template/app-shell/index.ts` — direct-import entry point.
- `src/pages/_app.tsx` — project-owned thin shim (global CSS + `<AppShell/>`).

## Migration (existing child projects)

`_app.tsx` is project-owned, so a sync does **not** replace a child's existing
`_app.tsx`; their current wiring keeps working. `<AppShell>` syncs in as new
files but stays unused until the child adopts the thin shim. To migrate, run the
**`/migrate-to-app-shell`** skill (`.ai/commands/migrate-to-app-shell.md`) after
syncing — it classifies the existing `_app.tsx`, replaces the standard tree with
the shim, and moves any project-specific providers into `wrapProviders`. It is
idempotent (no-ops if already migrated).
