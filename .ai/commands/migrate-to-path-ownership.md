# Migrate to Path Ownership Config

This command migrates a child project from the legacy hash-based template sync config to the new Path Ownership model, and validates that all `projectOverrides` are justified.

## When to Use

- Child project still uses legacy config (has `fileHashes`, `ignoredFiles`, `projectSpecificFiles`)
- To audit existing `projectOverrides` and ensure they're justified
- After folder restructuring migration

## Important: projectOverrides Philosophy

**projectOverrides are NOT for small tweaks.** They should only contain files where:

- The project has **significant, project-specific logic** that doesn't belong in the template
- The changes would **NOT benefit other projects** using the template
- The differences are **intentional and permanent**

**If changes are small or could benefit all projects** → Contribute to template instead and remove the override.

**Index files should NOT be in projectOverrides** → Use the three-file pattern instead (see Step 4).

---

## Process

### Step 1: Check Current Config Format

Read the current config:

```bash
cat .template-sync.json
```

**Identify the config type:**

| Config Type | Indicators |
|-------------|------------|
| **Legacy (hash-based)** | Has `fileHashes`, `ignoredFiles`, `projectSpecificFiles`, `templateIgnoredFiles` |
| **Path Ownership (new)** | Has `templatePaths`, `projectOverrides`, `overrideHashes` |

If already using Path Ownership, skip to **Step 4: Migrate Index Files** or **Step 5: Validate Overrides**.

---

### Step 2: Backup Legacy Config

```bash
cp .template-sync.json .template-sync.legacy.json
```

---

### Step 3: Create New Config

Write a new `.template-sync.json` with Path Ownership format:

```json
{
  "templateRepo": "git@github.com:gileck/app-template-ai.git",
  "templateBranch": "main",
  "templateLocalPath": "../app-template-ai",
  "lastSyncCommit": "<KEEP FROM LEGACY>",
  "lastSyncDate": "<KEEP FROM LEGACY>",

  "templatePaths": [
    "package.json",
    "tsconfig.json",
    ".eslintrc.js",
    "eslint.config.mjs",
    "postcss.config.mjs",
    "next.config.ts",
    "CLAUDE.md",
    "docs/template/**",
    "scripts/template/**",
    ".ai/commands/**",
    "src/client/components/ui/**",
    "src/client/query/**",
    "src/client/stores/**",
    "src/client/features/index.ts",
    "src/client/features/index.template.ts",
    "src/client/routes/index.ts",
    "src/client/routes/index.template.ts",
    "src/server/template/middleware/**",
    "src/server/template/utils/**",
    "src/server/database/index.ts",
    "src/server/database/collections/index.ts",
    "src/server/database/collections/index.template.ts",
    "src/server/database/collections/feature-requests/**",
    "src/server/database/collections/users/**",
    "src/server/database/collections/todos/**",
    "src/server/database/collections/reports/**",
    "src/apis/index.ts",
    "src/apis/index.template.ts",
    "src/pages/api/process/**",
    "app-guildelines/**",
    "task-manager/lib/**",
    "task-manager/tasks-cli.ts",
    "task-manager/README.md",
    "task-manager/TASK_FORMAT.md",
    "task-manager/TASK_COMMANDS.md",
    "task-manager/SLASH_COMMANDS_README.md",
    "task-manager/task-management-cli.md",
    "task-manager/.sync-info.md"
  ],

  "projectOverrides": [],

  "overrideHashes": {}
}
```

**CRITICAL:**
- Do NOT use broad globs like `src/server/database/**` - this would delete project-specific collections
- Be specific about which database files the template owns
- Index files use the three-file pattern, so `projectOverrides` should be empty

---

### Step 4: Migrate Index Files to Three-File Pattern

The template uses a three-file pattern for index files that eliminates the need for `projectOverrides`:

| File | Owner | Purpose |
|------|-------|---------|
| `index.template.ts` | Template | Template exports (synced) |
| `index.project.ts` | Project | Project exports (never synced) |
| `index.ts` | Template | Combines both (synced) |

**Create `index.project.ts` files for each location:**

#### 4.1: Features - `src/client/features/index.project.ts`

```typescript
/**
 * Project-Specific Features
 *
 * Add your project-specific feature exports here.
 * This file is NOT synced from template - it's owned by your project.
 */

// Add project-specific features below:
export * from './my-custom-feature';

// If no project features yet, use empty export:
// export {};
```

#### 4.2: Collections - `src/server/database/collections/index.project.ts`

```typescript
/**
 * Project-Specific Collections
 *
 * Add your project-specific collection exports here.
 * This file is NOT synced from template - it's owned by your project.
 */

// Add project-specific collections below:
export * as myItems from './my-items';

// If no project collections yet, use empty export:
// export {};
```

#### 4.3: APIs - `src/apis/index.project.ts`

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

#### 4.4: Routes - `src/client/routes/index.project.ts`

```typescript
/**
 * Project-Specific Routes
 *
 * Add your project-specific route definitions here.
 * This file is NOT synced from template - it's owned by your project.
 */

import type { Routes } from '../router';
import { MyPage } from './MyPage';

export const projectRoutes: Routes = {
  '/my-page': MyPage,
};

// If no project routes yet:
// export const projectRoutes: Routes = {};
```

**Important:** Empty files need `export {}` to be valid TypeScript modules.

---

### Step 5: Run Migration Sync

**5.1: Dry Run First**

```bash
yarn sync-template --dry-run
```

**Check the output carefully:**

| Section | What to Look For |
|---------|------------------|
| **To Delete** | Should NOT include project-specific files (custom database collections, custom features) |
| **To Copy** | Template files that will be synced |
| **Skipped** | Files in `projectOverrides` - these are protected |

**If project-specific files appear in "To Delete":**
1. Add them to `projectOverrides`, OR
2. Make `templatePaths` more specific

**5.2: Apply Sync**

```bash
yarn sync-template --auto-safe-only
```

**5.3: Verify**

```bash
yarn checks
```

Must pass with 0 errors.

**5.4: Commit**

```bash
git add -A
git commit -m "feat: migrate to Path Ownership template sync config

- Converted from legacy hash-based config to new Path Ownership model
- Template paths explicitly defined
- Migrated to three-file index pattern (no projectOverrides needed)
- Backed up legacy config as .template-sync.legacy.json

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Step 6: Validate projectOverrides (If Any Remain)

**CRITICAL STEP:** Each file in `projectOverrides` must be justified.

**6.1: List Current Overrides**

```bash
cat .template-sync.json | grep -A 20 '"projectOverrides"'
```

**If `projectOverrides` is empty `[]`, skip to Step 7.**

**6.2: For EACH Override, Compare with Template**

```bash
# Compare override with template version
diff -u ../app-template-ai/path/to/file.ts ./path/to/file.ts
```

**6.3: Classify Each Override**

| Classification | Action | Criteria |
|----------------|--------|----------|
| **Justified** | Keep | Significant project-specific logic, wouldn't benefit other projects |
| **Should Contribute** | Contribute to template, remove override | Bug fixes, improvements that benefit all projects |
| **Unnecessary** | Remove | File is identical or nearly identical to template |

**6.4: Decision Tree**

```
Is this an index file (features/index.ts, collections/index.ts, etc.)?
├── YES → Use three-file pattern instead (Step 4)
│
└── NO: Does template have this file?
    ├── NO: Is this genuinely project-specific?
    │   ├── YES → JUSTIFIED (keep override)
    │   └── NO → Template should have it → CONTRIBUTE
    │
    └── YES: What are the differences?
        ├── MAJOR (different logic, project-specific) → JUSTIFIED
        ├── MINOR (bug fixes, improvements) → CONTRIBUTE to template
        └── NONE/TRIVIAL → REMOVE from overrides
```

**6.5: Files That Should NEVER Be Overrides**

| File Pattern | Why | Solution |
|--------------|-----|----------|
| `**/index.ts` | Use three-file pattern | Create `index.project.ts` |
| `**/index.template.ts` | Template owns these | Remove override, sync from template |
| UI components with minor tweaks | Should benefit all projects | Contribute to template |

**6.6: Examples**

| File | Verdict | Reason |
|------|---------|--------|
| `src/client/features/index.ts` | **Use three-file pattern** | Create index.project.ts instead |
| `src/server/database/collections/index.ts` | **Use three-file pattern** | Create index.project.ts instead |
| `src/client/components/ui/button.tsx` | **Usually NOT Justified** | Style tweaks should go to template |
| `src/client/components/ui/custom-widget.tsx` | **Justified IF** project added it and template doesn't need it |

---

### Step 7: Take Action on Unjustified Overrides

**To remove an unnecessary override:**
1. Remove file path from `projectOverrides` array
2. Run `yarn sync-template` - template version will be copied
3. Run `yarn checks` to verify

**To contribute improvements to template:**
1. Copy the improved file to the template repository
2. Run `yarn checks` in template
3. Commit to template
4. Remove from child project's `projectOverrides`
5. Run `yarn sync-template` in child project

---

### Step 8: Final Validation Checklist

- [ ] Config uses Path Ownership format (`templatePaths`, `projectOverrides`)
- [ ] Legacy config backed up as `.template-sync.legacy.json`
- [ ] **Index files migrated to three-file pattern:**
  - [ ] `src/client/features/index.project.ts` exists
  - [ ] `src/server/database/collections/index.project.ts` exists
  - [ ] `src/apis/index.project.ts` exists
  - [ ] `src/client/routes/index.project.ts` exists
- [ ] `projectOverrides` is empty or contains only truly justified overrides
- [ ] `yarn sync-template --dry-run` shows no unexpected deletions
- [ ] `yarn checks` passes
- [ ] Changes committed

---

## Quick Reference

| Task | Command |
|------|---------|
| Check config | `cat .template-sync.json` |
| Dry run | `yarn sync-template --dry-run` |
| Compare file | `diff -u ../app-template-ai/path/file ./path/file` |
| Apply sync | `yarn sync-template --auto-safe-only` |
| Verify | `yarn checks` |

---

## Troubleshooting

### "To Delete" includes project-specific files

**Problem:** Broad patterns include project files.

**Solution:** Make `templatePaths` more specific:
```json
// BAD
"src/server/database/**"

// GOOD
"src/server/database/index.ts",
"src/server/database/collections/users/**"
```

### Override file nearly identical to template

**Problem:** Override has only trivial differences.

**Solution:**
1. If differences are intentional → Document why
2. If not intentional → Remove from `projectOverrides`

### Index files in projectOverrides

**Problem:** `features/index.ts` or similar in overrides.

**Solution:** Use the three-file pattern:
1. Create `index.project.ts` with your project exports
2. Remove from `projectOverrides`
3. Run `yarn sync-template` to get the combiner from template
