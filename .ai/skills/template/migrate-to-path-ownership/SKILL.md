# Migrate to Path Ownership Config

Migrate a child project from legacy hash-based template sync config to the new Path Ownership model, and validate that all projectOverrides are justified.

## Overview

The Path Ownership model provides:
- **Explicit path ownership** - Clear definition of which files the template owns
- **Deletion support** - Files removed from template are removed from projects
- **Simpler conflict detection** - No hash baseline drift issues

## When to Use This Skill

- Child project still uses legacy config (has `fileHashes`, `ignoredFiles`, `projectSpecificFiles`)
- After folder restructuring migration
- To audit existing `projectOverrides` for justification

---

## Phase 1: Check Current Config Status

**Read the project's `.template-sync.json`:**

```bash
cat .template-sync.json
```

**Legacy Config Indicators:**
- Has `fileHashes` object
- Has `ignoredFiles` array
- Has `projectSpecificFiles` array
- Has `templateIgnoredFiles` array

**Path Ownership Config Indicators:**
- Has `templatePaths` array
- Has `projectOverrides` array
- Has `overrideHashes` object (may be empty)

If already using Path Ownership, skip to Phase 4 (Override Validation).

---

## Phase 2: Prepare Migration

### Step 2.1: Backup Legacy Config

```bash
cp .template-sync.json .template-sync.legacy.json
```

### Step 2.2: Determine Template Paths

The template owns these paths (copy from template's standard config):

```json
{
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
    ".ai/skills/template/**",
    "src/client/components/ui/**",
    "src/client/query/**",
    "src/client/stores/**",
    "src/server/middleware/**",
    "src/server/utils/**",
    "src/server/database/index.ts",
    "src/server/database/collections/index.template.ts",
    "src/server/database/collections/feature-requests/**",
    "src/server/database/collections/users/**",
    "src/server/database/collections/todos/**",
    "src/server/database/collections/reports/**",
    "src/pages/api/process/**",
    "app-guildelines/**",
    "task-manager/**"
  ]
}
```

**CRITICAL:** Do NOT use broad patterns like `src/server/database/**` - this would delete project-specific database collections.

### Step 2.3: Identify Project Overrides

Project overrides are files within `templatePaths` that the project needs to keep different from the template.

**Common overrides:**
- `src/client/features/index.ts` - Project's feature exports
- `src/server/database/collections/index.ts` - Project's collection exports
- Project-specific UI components added to `src/client/components/ui/`

### Step 2.4: Create New Config

Write the new `.template-sync.json`:

```json
{
  "templateRepo": "git@github.com:gileck/app-template-ai.git",
  "templateBranch": "main",
  "templateLocalPath": "../app-template-ai",
  "lastSyncCommit": "<keep from legacy>",
  "lastSyncDate": "<keep from legacy>",

  "templatePaths": [
    // ... paths from Step 2.2
  ],

  "projectOverrides": [
    "src/client/features/index.ts",
    "src/server/database/collections/index.ts"
    // ... other project-specific files
  ],

  "overrideHashes": {}
}
```

---

## Phase 3: Run Migration Sync

### Step 3.1: Dry Run First

```bash
yarn sync-template --dry-run
```

**Check the output for:**
- `To Delete` - Should NOT include project-specific files (database collections, custom features)
- `To Copy` - Template files to sync
- `Skipped` - Files in `projectOverrides`

**If project-specific files appear in "To Delete":**
1. Either add them to `projectOverrides`
2. Or make `templatePaths` more specific (avoid broad globs)

### Step 3.2: Run Actual Sync

```bash
yarn sync-template --auto-safe-only
```

### Step 3.3: Verify

```bash
yarn checks
```

Must pass with 0 errors.

### Step 3.4: Commit

```bash
git add -A
git commit -m "feat: migrate to Path Ownership template sync config

- Converted from legacy hash-based config to new Path Ownership model
- Template paths explicitly defined
- Project-specific files protected via projectOverrides
- Backed up legacy config as .template-sync.legacy.json

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4: Validate Project Overrides

**CRITICAL:** Each file in `projectOverrides` must be justified. Overrides should be:
- Significant project-specific changes
- Logic that doesn't belong in the template
- NOT small fixes or improvements that could benefit all projects

### Step 4.1: List Current Overrides

```bash
cat .template-sync.json | grep -A 20 '"projectOverrides"'
```

### Step 4.2: Analyze Each Override

For each file in `projectOverrides`, compare with template:

```bash
# Example for a specific file
diff -u ../app-template-ai/path/to/file.ts ./path/to/file.ts
```

### Step 4.3: Classification Criteria

For each override, determine:

| Classification | Action | Criteria |
|----------------|--------|----------|
| **Justified Override** | Keep in projectOverrides | Project-specific logic, wouldn't benefit other projects |
| **Should Contribute** | Contribute to template, remove override | Improvements/fixes that benefit all projects |
| **Unnecessary Override** | Remove from projectOverrides | File is identical or nearly identical to template |

### Step 4.4: Examples of Justified Overrides

**`src/client/features/index.ts`** - ALWAYS justified
- Each project exports its own features
- Template has example features (Todos, Chat)
- Child projects have their own features

**`src/server/database/collections/index.ts`** - ALWAYS justified
- Each project exports its own collections
- Template has example collections
- Child projects have their own collections

**`src/client/components/ui/checkbox.tsx`** - Justified IF:
- Project added this component (template doesn't have it)
- Template shouldn't have it (not needed by all projects)

**`src/client/components/ui/button.tsx`** - Probably NOT justified:
- Template has this component
- Small style tweaks should be contributed to template
- Only justified if project needs radically different button behavior

### Step 4.5: Decision Tree for Each Override

```
1. Does the template have this file?
   ├─ NO → Is this a project-specific feature?
   │       ├─ YES → JUSTIFIED (keep override)
   │       └─ NO → Should template have it? → CONTRIBUTE to template
   │
   └─ YES → Compare differences:
            ├─ MAJOR differences (different logic, project-specific) → JUSTIFIED
            ├─ MINOR improvements (bug fixes, better patterns) → CONTRIBUTE
            └─ IDENTICAL or trivial → REMOVE from overrides
```

### Step 4.6: Taking Action

**To remove an unnecessary override:**
1. Remove file from `projectOverrides` array
2. Run `yarn sync-template` - template version will be copied
3. Verify with `yarn checks`

**To contribute improvements to template:**
1. Copy improved file to template repository
2. Run template's `yarn checks`
3. Commit to template
4. Remove from child project's `projectOverrides`
5. Run `yarn sync-template` in child project

---

## Phase 5: Final Validation Checklist

Run through this checklist to confirm successful migration:

- [ ] `.template-sync.json` uses Path Ownership format (has `templatePaths`, `projectOverrides`)
- [ ] Legacy config backed up as `.template-sync.legacy.json`
- [ ] `yarn sync-template --dry-run` shows no unexpected deletions
- [ ] `yarn checks` passes with 0 errors
- [ ] All `projectOverrides` are justified:
  - [ ] Each override has significant project-specific changes
  - [ ] No overrides that could be contributed to template
  - [ ] No unnecessary overrides (files identical to template)
- [ ] Changes committed with descriptive message

---

## Troubleshooting

### "To Delete" includes project-specific files

**Problem:** Broad glob patterns in `templatePaths` include project-specific files.

**Solution:** Make patterns more specific:
```json
// BAD - too broad
"src/server/database/**"

// GOOD - specific template files
"src/server/database/index.ts",
"src/server/database/collections/index.template.ts",
"src/server/database/collections/users/**",
"src/server/database/collections/todos/**"
```

### Override file is nearly identical to template

**Problem:** File in `projectOverrides` has only trivial differences.

**Solution:**
1. Determine if differences are intentional
2. If yes, document why in a comment
3. If no, remove from `projectOverrides` and let template version sync

### Template version overwrites project customizations

**Problem:** Forgot to add a customized file to `projectOverrides`.

**Solution:**
1. Add file to `projectOverrides` array
2. Restore your version from git: `git checkout HEAD -- path/to/file.ts`
3. Re-run `yarn sync-template`

---

## Quick Reference

**Check config type:**
```bash
cat .template-sync.json | head -20
```

**Dry run sync:**
```bash
yarn sync-template --dry-run
```

**Compare override with template:**
```bash
diff -u ../app-template-ai/path/to/file ./path/to/file
```

**Full sync:**
```bash
yarn sync-template --auto-safe-only
```

**Verify:**
```bash
yarn checks
```
