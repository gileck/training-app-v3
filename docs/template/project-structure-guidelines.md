---
title: Project Structure Guidelines
description: Where to put your project code and what not to modify. Use this when adding new features or modifying the codebase.
summary: "Template-owned paths sync automatically and should NOT be modified. Put project code in `project/` folders and `*.project.ts` files. Use `projectOverrides` only when absolutely necessary."
priority: 1
---

# Project Structure Guidelines

This project uses a **template sync system** that automatically updates certain files from the template repository. Understanding what you can modify and where to put your code is essential.

## Quick Reference

| Location | Owner | Can Modify? | Notes |
|----------|-------|-------------|-------|
| `src/client/features/template/**` | Template | ❌ No | Core template features (auth, settings, router, etc.) |
| `src/client/features/project/**` | Project | ✅ Yes | Put your custom features here |
| `src/client/routes/template/**` | Template | ❌ No | Core template routes (Settings, Profile, etc.) |
| `src/client/routes/project/**` | Project | ✅ Yes | Put your custom routes here |
| `src/apis/project/**` | Project | ✅ Yes | Your API handlers go here |
| `src/apis/template/**` | Template | ❌ No | Template APIs (auth, settings, reports, etc.) |
| `src/server/database/collections/project/**` | Project | ✅ Yes | Your collections |
| `src/server/database/collections/template/**` | Template | ❌ No | Template collections (users, reports, etc.) |
| `src/agents/**` | Template | ❌ No | Template agents |
| `*.project.ts` files | Project | ✅ Yes | Project-specific exports |
| `src/client/components/template/**` | Template | ❌ No | UI, layout, and shared components |
| `src/client/components/project/**` | Project | ✅ Yes | Your custom components |
| `src/client/components/NavLinks.tsx` | Template | ❌ No | Combiner for navigation items |
| `scripts/template/**` | Template | ❌ No | Synced from template |
| `docs/template/**` | Template | ❌ No | Synced from template |
| `.ai/skills/template/**` | Template | ❌ No | Synced from template |
| `*.template.ts` files | Template | ❌ No | Synced from template |

---

## The Ownership Model

### Template-Owned (DO NOT MODIFY)

These paths are **automatically synced** from the template. Any changes you make will be **overwritten** on the next sync:

```
scripts/template/**                    # Template scripts
docs/template/**                       # Template documentation
.ai/skills/template/**                 # Template AI skills
src/client/components/template/**      # Template components (ui/, layout/, etc.)
src/client/components/NavLinks.tsx     # Navigation combiner file
src/client/components/GlobalDialogs.tsx # Dialog combiner file
src/client/query/**                    # React Query setup
src/client/stores/**                   # Store factory
src/client/features/template/**        # Core template features (auth, settings, router, etc.)
src/client/features/index.ts           # Feature combiner file
src/client/features/index.template.ts  # Template feature exports
src/client/routes/template/**          # Core template routes (Settings, Profile, etc.)
src/client/routes/index.ts             # Route combiner file
src/client/routes/index.template.ts    # Template route exports
src/server/utils/**                    # Server utilities
src/server/middleware/**               # Server middleware
src/agents/**                          # AI agents system
config/**                              # ESLint, Next.js, TypeScript configs

# Template APIs and collections (use template/ subfolder)
src/apis/template/**
src/server/database/collections/template/**

*.template.ts                          # Template export files
```

> **Tip:** Check `.template-sync.template.json` for the complete list of template-owned paths.

### Project-Owned (SAFE TO MODIFY)

These paths are **yours** and never synced:

```
src/client/features/project/**   # Your custom features
src/client/routes/project/**     # Your custom routes
src/client/components/project/** # Your custom components
src/apis/project/**              # Your API modules
src/server/database/collections/project/** # Your DB collections
docs/project/**                  # Your documentation
.ai/skills/project/**            # Your AI skills
scripts/project/**               # Your scripts
*.project.ts                     # Your export files
```

---

## The Three-File Pattern

Index files use a **three-file pattern** to separate template and project exports:

```
index.ts           ← Template-owned (combines both)
index.template.ts  ← Template-owned (template exports)
index.project.ts   ← Project-owned (YOUR exports)
```

### Where This Pattern Is Used

1. **Features**: `src/client/features/`
2. **Routes**: `src/client/routes/`
3. **Collections**: `src/server/database/collections/`
4. **APIs**: `src/apis/`
5. **Navigation**: `src/client/components/` (NavLinks.tsx, NavLinks.template.tsx, NavLinks.project.tsx)

### Example: Adding a New Feature

```typescript
// src/client/features/index.project.ts (YOU EDIT THIS)
export * from './project/my-new-feature';
export * from './project/another-feature';
```

```typescript
// src/client/features/index.template.ts (DO NOT EDIT)
export * from './template/auth';
export * from './template/settings';
// ... template features
```

```typescript
// src/client/features/index.ts (DO NOT EDIT)
export * from './index.template';
export * from './index.project';
```

**Result:** Your features are automatically included without touching template files!

---

## Where to Put Your Code

### New Features

```
src/client/features/project/my-feature/
├── index.ts          # Public exports
├── store.ts          # Zustand store (if needed)
├── hooks.ts          # React hooks
├── types.ts          # TypeScript types
└── components/       # Feature components
    └── MyComponent.tsx
```

Then add to `src/client/features/index.project.ts`:
```typescript
export * from './project/my-feature';
```

### New Routes/Pages

```
src/client/routes/project/MyPage/
├── index.ts          # Re-exports page component
├── page.tsx          # Main page component
├── hooks.ts          # Page-specific hooks
└── components/       # Page-specific components
```

Then add to `src/client/routes/index.project.ts`:
```typescript
import { MyPage } from './project/MyPage';

export const projectRoutes: Routes = {
  '/my-page': MyPage,
};
```

### New APIs

```
src/apis/project/my-api/
├── index.ts          # Re-exports
├── client.ts         # Client-side API calls
├── server.ts         # Server handlers
├── types.ts          # Shared types
└── handlers/         # Individual handlers
    └── myHandler.ts
```

Then add to `src/apis/index.project.ts`:
```typescript
export * as myApi from './project/my-api';
```

### New Database Collections

```
src/server/database/collections/project/my-collection/
├── index.ts          # Re-exports
├── my-collection.ts  # Collection operations
└── types.ts          # Collection types
```

Then add to `src/server/database/collections/index.project.ts`:
```typescript
export * as myCollection from './project/my-collection';
```

### Custom UI Components

**DO NOT modify** `src/client/components/template/` - these are template-owned:
- `template/ui/` - shadcn components
- `template/layout/` - Layout components (TopNavBar, BottomNavBar, DrawerMenu, etc.)
- `template/clarify/` - Clarification components
- `template/Layout.tsx`, `template/ThemeProvider.tsx`, etc.

Instead, use `src/client/components/project/`:

```
src/client/components/project/
├── CustomButton.tsx      # Your custom button
├── SpecialCard.tsx       # Your custom card
├── NavLinks.project.tsx  # Your navigation items
└── index.ts              # Exports
```

Import as:
```typescript
import { CustomButton } from '@/client/components/project';
```

### Custom Navigation Items

Edit `src/client/components/project/NavLinks.project.tsx` to customize navigation:

```typescript
// NavLinks.project.tsx (YOU EDIT THIS)
export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home size={18} /> },
  { path: '/my-feature', label: 'My Feature', icon: <Star size={18} /> },
];

export const menuItems: NavItem[] = [...];
export const projectAdminMenuItems: NavItem[] = [...];
```

---

## When to Use projectOverrides

**Only use `projectOverrides` when you MUST modify a template-owned file.**

### Valid Reasons

1. Template component doesn't meet your specific needs
2. You need to fix a bug before template is updated
3. Project-specific configuration that can't be extended

### How to Add an Override

1. Modify the template file as needed
2. Add to `.template-sync.json`:
   ```json
   {
     "projectOverrides": [
       "src/client/components/template/ui/button.tsx"
     ]
   }
   ```
3. Commit your changes

### Risks of Overrides

- **No automatic updates**: Override files won't receive template improvements
- **Breaking changes**: Template updates may expect the original file
- **Maintenance burden**: You're responsible for keeping it updated

### Better Alternatives

| Instead of... | Try this... |
|---------------|-------------|
| Modifying `template/ui/button.tsx` | Create `project/CustomButton.tsx` |
| Modifying template feature | Create your own feature that extends it |
| Modifying template script | Create `scripts/project/my-script.ts` |
| Changing navigation items | Edit `project/NavLinks.project.tsx` |

---

## Contributing Back to Template

If your changes would benefit all projects:

1. **During sync**: Choose "Contribute to template" for the file
2. **View diffs**: Run `yarn sync-template --project-diffs`
3. **Create PR**: Submit changes to the template repository

This is better than overriding because:
- All projects benefit from improvements
- You get automatic updates
- No maintenance burden

---

## Common Mistakes to Avoid

### ❌ DON'T: Modify template files directly

```typescript
// ❌ WRONG: Editing src/client/components/template/ui/button.tsx
// ❌ WRONG: Editing src/client/components/template/layout/TopNavBar.tsx
```

### ✅ DO: Create project versions

```typescript
// ✅ CORRECT: Create src/client/components/project/CustomButton.tsx
// ✅ CORRECT: Edit src/client/components/project/NavLinks.project.tsx for navigation
```

---

### ❌ DON'T: Edit index.ts or index.template.ts

```typescript
// ❌ WRONG: Adding exports to src/client/features/index.ts
export * from './my-feature';  // Will be overwritten!
```

### ✅ DO: Edit index.project.ts

```typescript
// ✅ CORRECT: Adding exports to src/client/features/index.project.ts
export * from './my-feature';
```

---

### ❌ DON'T: Put project code in template folders

```
❌ WRONG:
scripts/template/my-script.ts
docs/template/my-doc.md
```

### ✅ DO: Use project folders

```
✅ CORRECT:
scripts/project/my-script.ts
docs/project/my-doc.md
```

---

## Folder Structure Summary

```
project-root/
├── .ai/skills/
│   ├── template/        # ❌ Template-owned
│   └── project/         # ✅ Your skills
├── docs/
│   ├── template/        # ❌ Template-owned
│   └── project/         # ✅ Your docs
├── scripts/
│   ├── template/        # ❌ Template-owned
│   └── project/         # ✅ Your scripts
├── src/
│   ├── agents/          # ❌ Template-owned (AI agents system)
│   ├── apis/
│   │   ├── index.ts           # ❌ Template-owned (combiner)
│   │   ├── index.template.ts  # ❌ Template-owned
│   │   ├── index.project.ts   # ✅ Your API exports
│   │   ├── template/          # ❌ Template APIs (auth, settings, reports, etc.)
│   │   └── project/           # ✅ Your APIs
│   ├── client/
│   │   ├── components/
│   │   │   ├── template/      # ❌ Template-owned (ui/, layout/, etc.)
│   │   │   ├── project/       # ✅ Your components & NavLinks.project.tsx
│   │   │   ├── NavLinks.tsx   # ❌ Template-owned (combiner)
│   │   │   └── GlobalDialogs.tsx # ❌ Template-owned (combiner)
│   │   ├── features/
│   │   │   ├── template/      # ❌ Template-owned (auth, settings, router, etc.)
│   │   │   ├── project/       # ✅ Put your custom features here
│   │   │   ├── index.ts       # ❌ Template-owned (combiner)
│   │   │   ├── index.template.ts # ❌ Template-owned
│   │   │   └── index.project.ts  # ✅ Your feature exports
│   │   └── routes/
│   │       ├── template/      # ❌ Template-owned (Settings, Profile, etc.)
│   │       ├── project/       # ✅ Put your custom routes here (Home, Todos, etc.)
│   │       ├── index.ts       # ❌ Template-owned (combiner)
│   │       ├── index.template.ts # ❌ Template-owned
│   │       └── index.project.ts  # ✅ Your route exports
│   └── server/
│       └── database/collections/
│           ├── index.ts           # ❌ Template-owned (combiner)
│           ├── index.template.ts  # ❌ Template-owned
│           ├── index.project.ts   # ✅ Your collection exports
│           ├── template/          # ❌ Template collections (users, reports, etc.)
│           └── project/           # ✅ Your collections
├── .template-sync.json           # ✅ Your sync config (project overrides)
└── .template-sync.template.json  # ❌ Template-owned (defines templatePaths)
```

> **Note:** Features, routes, and components use the `template/` and `project/` subfolder pattern. Template code (auth, settings, router, ui components, layout, etc.) is synced from the template. Your custom code goes in the `project/` subfolders. Navigation items are customized via `NavLinks.project.tsx`.

---

## Verification Commands

```bash
# Check what's template-owned
yarn sync-template --show-drift

# Preview what would change on sync
yarn sync-template --dry-run

# See all differences from template
yarn sync-template --diff-summary
```

---

## Summary

1. **Put project code in `project/` folders and `*.project.ts` files**
2. **Never modify template-owned files** unless absolutely necessary
3. **Use `projectOverrides` sparingly** - prefer creating project versions
4. **Contribute improvements** back to template when possible
5. **Run `yarn sync-template --dry-run`** regularly to stay in sync
