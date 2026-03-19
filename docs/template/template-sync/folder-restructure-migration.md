# Folder Restructure Migration Guide

**Date:** January 2026

This guide explains the folder restructuring in the template and how to migrate child projects.

---

## Quick Start (TL;DR)

For experienced users, run these commands in your child project:

```bash
# 1. Sync new structure (auto-applies safe changes, commits automatically)
yarn sync-template --auto-safe-only

# 2. Verify everything works
yarn checks

# 3. Remove old folders
yarn cleanup-old-folders --force

# 4. Commit cleanup
git add -A && git commit -m "chore: cleanup old folder structure after template migration"

# 5. (Optional) Migrate to Path Ownership config for future automatic deletions
yarn sync-template --migrate
```

**Result:** 2 commits will be created:
1. `chore: sync template (abc123)` - from sync-template (automatic)
2. `chore: cleanup old folder structure` - from your manual commit

---

## What Changed

The template now organizes files into `template/` and `project/` subfolders for clearer ownership:

| Before | After |
|--------|-------|
| `scripts/template-scripts/` | `scripts/template/` |
| `.ai/skills/*` | `.ai/commands/*` |
| `docs/*.md` | `docs/template/*.md` |
| `docs/template-sync/` | `docs/template/template-sync/` |
| `docs/github-agents-workflow/` | `docs/template/github-agents-workflow/` |

### Why This Change?

1. **Clear ownership**: Template-owned files are now clearly separated from project-owned files
2. **Easier sync**: The new Path Ownership Model can sync entire folders including deletions
3. **Less confusion**: No more wondering "is this file from the template or did I create it?"

### New Folder Structure

```
scripts/
├── template/           # Template-owned scripts (synced from template)
│   ├── sync-template/
│   ├── ai-agents/
│   └── ...
└── project/           # Project-owned scripts (your custom scripts)

.ai/commands/            # Slash commands (synced from template)

docs/
├── template/         # Template-owned docs (synced from template)
│   ├── template-sync/
│   ├── github-agents-workflow/
│   └── *.md
└── project/         # Project-owned docs (your custom docs)
```

---

## Migration Steps for Child Projects

### Step 1: Sync Template Updates

First, sync the template to get the new folder structure:

```bash
# Interactive mode (prompts for confirmation)
yarn sync-template

# OR non-interactive mode (recommended for automation)
yarn sync-template --auto-safe-only
```

This will:
- Add all new files in `scripts/template/`, `.ai/commands/`, `docs/template/`
- Update `package.json` with new script paths
- Run validation (`yarn checks`) automatically
- **Auto-commit** the synced changes with message: `chore: sync template (abc123)`
- NOT delete old folders (legacy config doesn't handle deletions)

### Step 2: Verify Everything Works

```bash
yarn checks
yarn dev
```

If there are errors:
- Check if any imports reference old paths
- The new `package.json` scripts should use `scripts/template/` paths

### Step 3: Run Cleanup Script

Remove the old folders with the cleanup script:

```bash
# Preview what will be deleted
yarn cleanup-old-folders --dry-run

# Delete old folders
yarn cleanup-old-folders
```

This removes:
- `scripts/template-scripts/` (replaced by `scripts/template/`)
- `.ai/skills/*` root-level skills (replaced by `.ai/commands/*`)
- `docs/*.md` root-level docs (replaced by `docs/template/*.md`)
- `docs/template-sync/` (replaced by `docs/template/template-sync/`)
- `docs/github-agents-workflow/` (replaced by `docs/template/github-agents-workflow/`)

### Step 4: Commit the Changes

```bash
git add -A
git commit -m "chore: migrate to new template folder structure"
```

---

## Manual Cleanup (Alternative)

If you prefer to clean up manually:

```bash
# Remove old scripts folder
rm -rf scripts/template-scripts/

# Remove old skill folders (keep template/ and project/)
rm -rf .ai/skills/ai-models-api-usage
rm -rf .ai/skills/app-guidelines-checklist
# ... (repeat for all skill folders)

# Remove old doc files at root
rm docs/*.md

# Remove old doc folders (if new ones exist)
rm -rf docs/template-sync
rm -rf docs/github-agents-workflow
```

---

## Optional: Migrate to Path Ownership Config

For automatic handling of future deletions, consider migrating to the Path Ownership config model:

```bash
yarn sync-template --migrate
```

This converts your `.template-sync.json` from:

```json
{
  "ignoredFiles": [...],
  "projectSpecificFiles": [...],
  "fileHashes": {...}
}
```

To:

```json
{
  "templatePaths": [
    "scripts/template/**",
    ".ai/commands/**",
    "docs/template/**",
    ...
  ],
  "projectOverrides": [...]
}
```

Benefits of Path Ownership:
- Template deletions are synced automatically
- Simpler configuration
- No hash drift issues

---

## Troubleshooting

### "Module not found" errors after sync

The old `package.json` may reference `scripts/template-scripts/`. After syncing, the new `package.json` should use `scripts/template/`. If you see errors:

1. Check that `package.json` was updated
2. Run `yarn install` to update dependencies
3. If still failing, manually update script paths

### Old folders still exist after sync

This is expected with the legacy hash-based config. Run:

```bash
yarn cleanup-old-folders
```

### Skills not loading after cleanup

Make sure you didn't delete `.ai/commands/` - only delete the root-level skill folders.

### Custom skills were deleted

If you had custom skills in `.ai/skills/`, they have been consolidated into `.ai/commands/`. The cleanup script only deletes known template skill folders.

---

## Summary

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `yarn sync-template` | Get new folder structure |
| 2 | `yarn checks` | Verify no errors |
| 3 | `yarn cleanup-old-folders` | Remove old folders |
| 4 | `git commit` | Commit changes |

Optional:
| Step | Command | Purpose |
|------|---------|---------|
| 5 | `yarn sync-template --migrate` | Switch to Path Ownership config |
