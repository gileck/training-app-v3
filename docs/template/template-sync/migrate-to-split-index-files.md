# Migration Guide: Split Index Files (Template + Project)

> **Why This Pattern?**
>
> Index files (features, collections, APIs, routes) need to export both template code AND project-specific code. The three-file pattern cleanly separates ownership:
> - `index.template.ts` - Template exports (synced from template)
> - `index.project.ts` - Project exports (owned by your project)
> - `index.ts` - Simple combiner (synced from template)
>
> **Result:** No merge conflicts, no `projectOverrides` needed for these files!

---

## The Three-File Pattern

Each index location uses three files:

| File | Owner | Purpose |
|------|-------|---------|
| `index.template.ts` | Template | Exports template-provided code |
| `index.project.ts` | Project | Exports project-specific code |
| `index.ts` | Template | Combines both (just re-exports) |

**Key insight:** The `index.ts` combiner is owned by template and syncs automatically. Your project-specific exports go in `index.project.ts` which is never touched by sync.

---

## Files Using This Pattern

The template uses this pattern in 4 locations:

1. `src/client/features/` - Client features
2. `src/server/database/collections/` - Database collections
3. `src/apis/` - API exports
4. `src/client/routes/` - Route definitions

---

## Migration Steps

### 1. Features: `src/client/features/`

**Create `index.project.ts`** with your project-specific features:

```typescript
/**
 * Project-Specific Features
 *
 * Add your project-specific feature exports here.
 * This file is NOT synced from template - it's owned by your project.
 */

// Add project-specific features below:
export * from './my-custom-feature';
export * from './another-feature';

// If no project features yet, use empty export:
// export {};
```

**Template provides** `index.template.ts` and `index.ts` (these sync automatically).

---

### 2. Collections: `src/server/database/collections/`

**Create `index.project.ts`** with your project-specific collections:

```typescript
/**
 * Project-Specific Collections
 *
 * Add your project-specific collection exports here.
 * This file is NOT synced from template - it's owned by your project.
 */

// Add project-specific collections below:
export * as myItems from './my-items';
export * as customData from './custom-data';

// If no project collections yet, use empty export:
// export {};
```

**Template provides** `index.template.ts` (users, reports, feature-requests, todos) and `index.ts`.

---

### 3. APIs: `src/apis/`

**Create `index.project.ts`** with your project-specific API exports:

```typescript
/**
 * Project-Specific APIs
 *
 * Add your project-specific API exports here.
 * This file is NOT synced from template - it's owned by your project.
 */

// Add project-specific APIs below:
export * as myApi from './my-api';

// If no project APIs yet, use empty export:
// export {};
```

**Template provides** `index.template.ts` (chat, clearCache) and `index.ts`.

---

### 4. Routes: `src/client/routes/`

**Create `index.project.ts`** with your project-specific routes:

```typescript
/**
 * Project-Specific Routes
 *
 * Add your project-specific route definitions here.
 * This file is NOT synced from template - it's owned by your project.
 */

import type { Routes } from '../router';
import { MyPage } from './MyPage';
import { CustomFeature } from './CustomFeature';

export const projectRoutes: Routes = {
  '/my-page': MyPage,
  '/custom-feature': CustomFeature,
};

// If no project routes yet:
// export const projectRoutes: Routes = {};
```

**Template provides** `index.template.ts` (Home, Todos, AIChat, Settings, etc.) and `index.ts`.

---

## Template Sync Configuration

After migration, your `.template-sync.json` should include these in `templatePaths`:

```json
{
  "templatePaths": [
    "src/client/features/index.ts",
    "src/client/features/index.template.ts",
    "src/server/database/collections/index.ts",
    "src/server/database/collections/index.template.ts",
    "src/apis/index.ts",
    "src/apis/index.template.ts",
    "src/client/routes/index.ts",
    "src/client/routes/index.template.ts"
  ],
  "projectOverrides": []
}
```

**Note:** `index.project.ts` files are NOT in `templatePaths` because they're owned by your project.

---

## TypeScript Requirement

Empty `index.project.ts` files need an export to be valid TypeScript modules:

```typescript
// If you have no project-specific exports yet:
export {};
```

Without this, TypeScript will error with "File is not a module".

---

## Verification

After migration:

1. **Run checks:**
   ```bash
   yarn checks
   ```

2. **Test the app:**
   ```bash
   yarn dev
   ```

3. **Verify sync works:**
   ```bash
   yarn sync-template --dry-run
   ```

   Should show no conflicts for index files.

---

## Before vs After

### Before (Two-File Pattern - OLD)

```
index.ts         ← Project owns, contains both template + project code
index.template.ts ← Template owns, synced
```

**Problem:** `index.ts` needed to be in `projectOverrides` to prevent sync conflicts.

### After (Three-File Pattern - NEW)

```
index.ts          ← Template owns, just combines the two
index.template.ts ← Template owns, template exports
index.project.ts  ← Project owns, project exports
```

**Solution:** No `projectOverrides` needed! Template syncs `index.ts` and `index.template.ts`, project owns `index.project.ts`.

---

## Summary Checklist

- [ ] Created `src/client/features/index.project.ts` with project features
- [ ] Created `src/server/database/collections/index.project.ts` with project collections
- [ ] Created `src/apis/index.project.ts` with project APIs
- [ ] Created `src/client/routes/index.project.ts` with project routes
- [ ] Added index.ts and index.template.ts to `templatePaths`
- [ ] Removed index.ts files from `projectOverrides` (should be empty now)
- [ ] Run `yarn checks` - passes with 0 errors
- [ ] Run `yarn dev` - app works correctly
- [ ] Run `yarn sync-template --dry-run` - no conflicts on index files
