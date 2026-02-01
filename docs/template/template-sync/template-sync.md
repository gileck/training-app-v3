# Template Sync Guide

This template includes a powerful template sync system that allows you to merge updates from the template repository into projects created from it.

## Overview

When you create a new app from this template, you can continue to receive updates and improvements from the template while maintaining your own customizations.

## Configuration Model

The sync system uses the **Path Ownership Model** with explicit path declarations:

- **`templatePaths`**: Paths owned by the template (synced exactly, including deletions)
- **`projectOverrides`**: Files within templatePaths that the project wants to keep different

**Key behaviors:**
- Template-owned files are synced exactly (additions, modifications, AND deletions)
- If template deletes a file, it's deleted from the project
- Project overrides are kept different from template
- Clear, explicit ownership - no hash drift issues

> **Note:** The legacy hash-based config is no longer supported. If you have a project using the old format (with `ignoredFiles`, `projectSpecificFiles`, `fileHashes`), run `yarn sync-template --migrate` to convert to the Path Ownership model.

---

## Path Ownership Model (Recommended)

### How It Works

1. **Template paths** are synced exactly - what's in template appears in project
2. **Deletions** are synced - if template removes a file, it's removed from project
3. **Project overrides** let you keep specific files different from template
4. **package.json** uses 3-way merge to preserve project dependencies

### Split Config Files (Recommended)

The Path Ownership model uses **two separate config files** to prevent merge conflicts:

| File | Owner | Contents | Synced? |
|------|-------|----------|---------|
| `.template-sync.template.json` | Template | `templatePaths`, `templateIgnoredFiles` | ✅ Yes |
| `.template-sync.json` | Project | `templateRepo`, `projectOverrides`, etc. | ❌ No |

**Benefits:**
- When template adds new paths, they sync automatically
- No merge conflicts (files have completely different fields)
- Clear ownership: template controls what to sync, project controls its overrides

#### Template Config (`.template-sync.template.json`)

This file is **synced from the template** and defines what the template owns:

```json
{
  "templatePaths": [
    "package.json",
    "tsconfig.json",
    ".eslintrc.js",
    "CLAUDE.md",
    "docs/template/**",
    "scripts/template/**",
    ".ai/skills/template/**",
    "src/client/components/ui/**",
    "src/server/middleware/**",
    ".template-sync.template.json"
  ],
  "templateIgnoredFiles": [
    "src/apis/todos/**",
    "src/client/routes/Todos/**"
  ]
}
```

> **Note:** The template config file includes itself in `templatePaths` to ensure it stays synced.

#### Project Config (`.template-sync.json`)

This file is **project-owned** and never synced:

```json
{
  "templateRepo": "git@github.com:yourusername/app-template-ai.git",
  "templateBranch": "main",
  "templateLocalPath": "../app-template-ai",
  "lastSyncCommit": "abc123...",
  "lastSyncDate": "2024-01-01T00:00:00.000Z",
  "projectOverrides": [
    "src/client/components/ui/badge.tsx"
  ],
  "overrideHashes": {}
}
```

### Sync Process

When you run `yarn sync-template`:

1. **Template config synced first** - `.template-sync.template.json` is updated from template
2. **Config reloaded** - New `templatePaths` are now active
3. **Files synced** - All files matching the (possibly updated) `templatePaths` are synced

This ensures that when the template adds new paths to `templatePaths`, those files are synced in the same operation.

### Legacy Single-File Config

For backwards compatibility, the sync tool also supports a single `.template-sync.json` file containing all fields:

```json
{
  "templateRepo": "git@github.com:yourusername/app-template-ai.git",
  "templateBranch": "main",
  "templateLocalPath": "../app-template-ai",
  "lastSyncCommit": "abc123...",
  "lastSyncDate": "2024-01-01T00:00:00.000Z",

  "templatePaths": [
    "package.json",
    "tsconfig.json",
    ".eslintrc.js",
    "CLAUDE.md",
    "docs/template/**",
    "scripts/template/**",
    ".ai/skills/template/**",
    "src/client/components/ui/**",
    "src/server/middleware/**"
  ],

  "projectOverrides": [
    "src/client/components/ui/badge.tsx"
  ],

  "overrideHashes": {}
}
```

### Key Fields

| Field | Purpose |
|-------|---------|
| `templatePaths` | Globs/paths owned by template (synced exactly) |
| `projectOverrides` | Files to keep different from template |
| `overrideHashes` | Auto-managed hashes for detecting template changes to overrides |

### Sync Behavior

For each file matching `templatePaths`:

1. **File in template:**
   - If in `projectOverrides` AND template changed → **CONFLICT** (ask user)
   - If in `projectOverrides` AND template unchanged → **SKIP**
   - If `package.json` → **3-WAY MERGE** (preserves your deps)
   - Else → **COPY** from template

2. **File in project but NOT in template:**
   - If in `projectOverrides` → **KEEP**
   - Else → **DELETE** (template removed it)

### Example Output

```
🔄 Folder Ownership Sync
============================================================

📊 Analysis Summary:
  📥 To copy:   15 files (template → project)
  🗑️  To delete:  2 files (removed from template)
  🔀 To merge:   1 file (package.json)
  ⏭️  To skip:    3 files (project overrides)
  ⚠️  Conflicts:  1 file (override changed in template)

🔄 Applying changes...
  ✨ src/server/middleware/auth.ts
  📝 src/client/components/ui/button.tsx
  🗑️  src/old-deprecated-file.ts
  🔀 package.json - merged
  ⏭️  src/client/components/ui/badge.tsx (project override)
  ⚠️  src/app.config.js - template changed (override conflict)
```

---

## Initial Setup (For New Projects)

When you create a new project from this template:

### 1. Initialize Template Tracking

```bash
yarn init-template https://github.com/yourusername/app-template-ai.git
```

Replace `yourusername` with your GitHub username or organization.

> **Note:** SSH is used by default for authentication. The HTTPS URL you provide is automatically converted to SSH format. Use `--use-https` flag if you prefer HTTPS.

This creates a `.template-sync.json` configuration file.

### 2. Customize Configuration

#### Path Ownership Config (Recommended)

```json
{
  "templateRepo": "git@github.com:yourusername/app-template-ai.git",
  "templateBranch": "main",
  "templateLocalPath": "../app-template-ai",
  "lastSyncCommit": "abc123...",
  "lastSyncDate": "2024-01-01T00:00:00.000Z",

  "templatePaths": [
    "package.json",
    "tsconfig.json",
    ".eslintrc.js",
    "eslint.config.mjs",
    "CLAUDE.md",
    "docs/template/**",
    "scripts/template/**",
    ".ai/skills/template/**",
    "src/client/components/ui/**",
    "src/client/query/**",
    "src/client/stores/**",
    "src/server/middleware/**",
    "src/server/utils/**",
    "src/pages/api/process/**"
  ],

  "projectOverrides": [
    "src/client/components/ui/badge.tsx"
  ],

  "overrideHashes": {}
}
```

**Key fields:**
- `templatePaths`: Paths owned by template - synced exactly including deletions (supports globs)
- `projectOverrides`: Files you want to keep different from template (won't be overwritten)
- `overrideHashes`: Auto-managed hashes for tracking template changes to your overrides

### Local Template Path (Performance Optimization)

If you have the template repository cloned locally (e.g., you're developing both the template and child projects), you can configure `templateLocalPath` for much faster syncing:

```json
{
  "templateLocalPath": "../app-template-ai"
}
```

**Benefits:**
- **Much faster**: Uses local `git clone --local` instead of network clone
- **Works offline**: No network required when local path is available
- **Automatic fallback**: If local path is invalid, falls back to remote clone

**Path format:**
- Relative paths (e.g., `../app-template-ai`) are resolved from the project root
- Absolute paths (e.g., `/Users/me/projects/app-template-ai`) work too

**Note:** The local path must be a valid git repository with a `.git` directory.

---

## Migration: Legacy to Path Ownership (Required)

If you have a project using the legacy hash-based config (with `ignoredFiles`, `projectSpecificFiles`, `fileHashes`), you **must** migrate to the Path Ownership model. The legacy config format is no longer supported.

### Migration Process

Run the interactive migration wizard:

```bash
yarn sync-template --migrate
```

The wizard will:
1. Show you the suggested `templatePaths` based on common patterns
2. Identify your `projectOverrides` from your current customizations
3. Create a backup of your legacy config (`.template-sync.legacy.json`)
4. Save the new config to `.template-sync.json`

### Migration Help

For more details on the migration process:

```bash
yarn sync-template --migration-help
```

---

**Glob pattern support:**
Both `templatePaths` and `projectOverrides` support glob patterns:
- `*` - Matches any characters except `/` (within a single directory)
- `**` - Matches any characters including `/` (across directories)

**Examples:**
```json
{
  "templatePaths": [
    "docs/template/**",                    // Everything under docs/template
    "src/client/components/ui/**",         // All UI components
    "scripts/template/*.ts"                // All .ts files in scripts/template
  ],
  "projectOverrides": [
    "src/client/components/ui/badge.tsx"   // Specific file to keep different
  ]
}
```

### 3. Commit the Configuration

```bash
git add .template-sync.json
git commit -m "Initialize template tracking"
```

## Syncing Template Updates

### Preview Changes (Dry Run)

```bash
yarn sync-template --dry-run
```

This shows what would be synced without making any changes.

### Sync Updates (Interactive Mode)

```bash
yarn sync-template
```

The script will:
1. Clone the latest template
2. **Analyze and categorize all changes**:
   - ✅ **Safe changes**: Only changed in template (no conflicts)
   - ⚠️ **Potential conflicts**: Changed in BOTH template and your project
   - ✅ **Project customizations**: Only changed in your project (template unchanged) - NOT conflicts!
   - ⏭️ **Skipped**: Ignored or project-specific files
3. **Ask you what to do**:
   - `[1] Safe only` - Apply only safe changes (recommended first step)
   - `[2] All changes` - Apply all changes, with interactive conflict resolution
   - `[3] Cancel` - Don't apply any changes

> **Smart Conflict Detection:** The script checks BOTH sides before flagging a conflict. If only your project changed a file (template didn't touch it), it's recognized as a "project customization" and kept as-is - NOT flagged as a conflict!

**Example interaction:**

```
📊 ANALYSIS SUMMARY
============================================================

✅ Safe changes (12 files):
   Only changed in template, no conflicts:
   • src/client/components/ui/button.tsx
   • src/server/middleware/auth.ts
   ...

⚠️  Potential conflicts (2 files):
   Changed in both template and your project:
   • src/server/index.ts
   ...

✅ Project customizations (3 files):
   Changed only in your project (template unchanged):
   • src/client/components/ui/badge.tsx
   • src/client/features/auth/store.ts
   ...

🤔 What would you like to do?

  [1] Safe only  - Apply only safe changes (skip conflicts)
  [2] All changes - Apply safe changes + choose how to handle each conflict
  [3] Cancel     - Don't apply any changes

   Note: Project customizations will be kept automatically.

Enter your choice (1/2/3):
```

### Interactive Conflict Resolution

When you choose `[2] All changes` and there are conflicts, the script enters **interactive conflict resolution mode**:

1. **Shows the list of conflicting files**
2. **Asks how you want to handle them**:
   - `[1]` Apply the same action to all conflicting files (bulk)
   - `[2]` Choose an action for each file individually

3. **For each conflict, you choose one of four actions**:
   - `[1] Override with template` - Replace your version with the template version
   - `[2] Skip file` - Keep your current version, ignore template changes
   - `[3] Merge` - Save template version as `.template` file for manual merge
   - `[4] Do nothing` - Leave file unchanged for now

**Example conflict resolution:**

```
============================================================
📋 FILES WITH POTENTIAL CONFLICTS
============================================================

These files have changes in both your project AND the template:

  1. src/server/index.ts
  2. src/client/routes/Home/page.tsx

────────────────────────────────────────────────────────────
⚠️  CONFLICT RESOLUTION (2 files)
────────────────────────────────────────────────────────────

How would you like to handle the conflicting files?

  [1] Apply the same action to all conflicting files
  [2] Choose an action for each file individually

Enter your choice (1/2): 2

📋 Choose an action for each conflicting file:

🤖 AI descriptions enabled (cursor-agent detected)

────────────────────────────────────────────────────────────

📄 File 1 of 2: src/server/index.ts

   📊 Template changes: +15 lines, -3 lines
   📝 Template: Adds error handling middleware with retry logic
   📝 Your changes: Custom route registration for auth endpoints

  [1] Override with template - Replace your changes with template version
  [2] Skip file              - Keep your current version, ignore template
  [3] Merge                  - Apply template changes (may cause conflicts)
  [4] Do nothing             - Leave file unchanged for now

Action for src/server/index.ts (1/2/3/4): 3
   ✓ Will merge (may conflict)

────────────────────────────────────────────────────────────

📄 File 2 of 2: src/client/routes/Home/page.tsx

   📊 Template changes: +8 lines, -2 lines
   📝 Template: Updates layout component with new responsive grid
   📝 Your changes: Added custom hero section for landing page

  [1] Override with template - Replace your changes with template version
  [2] Skip file              - Keep your current version, ignore template
  [3] Merge                  - Apply template changes (may cause conflicts)
  [4] Do nothing             - Leave file unchanged for now

Action for src/client/routes/Home/page.tsx (1/2/3/4): 1
   ✓ Will override with template

────────────────────────────────────────────────────────────
📊 CONFLICT RESOLUTION SUMMARY
────────────────────────────────────────────────────────────

🔄 Override with template (1 files):
   • src/client/routes/Home/page.tsx

🔀 Merge (1 files):
   • src/server/index.ts

Proceed with these actions? (y/n): y
```

**Resolution actions explained:**

| Action | What happens | When to use |
|--------|-------------|-------------|
| **Override** | Your changes are replaced with template version | Template version is better, discard your changes |
| **Skip** | Your version is kept, template ignored | Your changes are important, don't want template updates |
| **Merge** | Creates `.template` file for manual merge | Need to combine both versions carefully |
| **Do nothing** | File left unchanged | Decide later, not ready to handle now |

### AI-Powered Change Descriptions

When `cursor-agent` CLI is installed, the sync tool provides **AI-generated descriptions** of changes to help you make informed decisions:

```
📄 File 1 of 2: src/server/index.ts

   📊 Template changes: +15 lines, -3 lines
   📝 Template: Adds error handling middleware with retry logic
   📝 Your changes: Custom route registration for auth endpoints
```

**Features:**
- **Template description**: What the template changed in this file
- **Your changes description**: What you changed locally
- **Automatic fallback**: Shows code preview if `cursor-agent` is unavailable
- **10-second timeout**: Won't slow down sync if AI is unresponsive

**Installing cursor-agent:**
```bash
curl https://cursor.com/install -fsS | bash
```

Without `cursor-agent`, you'll see a code diff preview instead of AI descriptions.

### Auto Modes (Non-Interactive)

For automated workflows or CI/CD, use explicit auto flags:

```bash
# Apply only safe changes, skip all conflicts
yarn sync-template --auto-safe-only

# Apply all changes, create .template files for conflicts (manual merge needed)
yarn sync-template --auto-merge-conflicts

# Apply all changes, override conflicts with template version (discards your changes)
yarn sync-template --auto-override-conflicts

# Apply safe changes, skip all conflicting files (keep your versions)
yarn sync-template --auto-skip-conflicts
```

| Flag | Safe Changes | Conflicts |
|------|-------------|-----------|
| `--auto-safe-only` | ✅ Applied | ⏭️ Skipped |
| `--auto-merge-conflicts` | ✅ Applied | 🔀 Creates `.template` files |
| `--auto-override-conflicts` | ✅ Applied | 🔄 Replaced with template |
| `--auto-skip-conflicts` | ✅ Applied | ⏭️ Skipped |

### Initialize Baseline Hashes

For projects that were synced before the hash system, or to establish a clean baseline:

```bash
yarn sync-template --init-hashes
```

This initializes baseline hashes for all template files:
- **Identical files**: Stores the shared hash
- **Different files**: Stores the template's hash as baseline (your changes become "project customizations")

**When to use:**
- First time syncing after the hash system was introduced
- After manually resolving many conflicts
- To reset the baseline to current template state

**Example output:**
```
🔧 Initialize Baseline Hashes
============================================================

📍 Template commit: 735d623...
📊 Existing baseline hashes: 0

🔄 Initializing hashes...

============================================================
📊 RESULTS
============================================================

✅ Identical files (hash stored):      281
📝 Different files (template baseline): 7
⏭️  Skipped (ignored/project-specific):  14

📦 Total hashes stored: 288

💡 Note: For files that differ, the TEMPLATE version is the baseline.
   These will show as "project customizations" on next sync.
```

### Auto-Commit Behavior

When changes are applied, the sync tool **automatically commits** them:

```
📦 Committing synced files...
   ✅ Committed as abc1234
```

This ensures that:
- The sync tracking (`lastProjectCommit`) is accurate
- Future syncs won't show false conflicts
- You have a clean commit history with template sync commits

The commit message format is: `chore: sync template (abc1234)` where `abc1234` is the template commit hash.

### Handling Conflicts (Merge Strategy)

When you choose "Merge" for a conflict, the script creates a `.template` file for manual review:

1. **Review the conflict:**
   ```bash
   # Your version
   cat src/some-file.ts
   
   # Template version
   cat src/some-file.ts.template
   ```

2. **Manually merge:**
   - Use your preferred merge tool
   - Or manually combine the changes
   - Keep the parts you need from both versions

3. **Clean up and commit:**
   ```bash
   # After merging, delete the template version and commit
   rm src/some-file.ts.template
   git add .
   git commit -m "Resolve template merge conflicts"
   ```

## Sync Results

After syncing, you'll see:

```
📊 SYNC RESULTS
============================================================

✅ Applied successfully (15 files):
   src/client/components/ui/button.tsx
   src/client/config/defaults.ts
   src/client/routes/Home/page.tsx  (overridden from template)
   ...

🔀 Needs manual merge (1 files):
   src/server/index.ts
      → Template version saved to: src/server/index.ts.template

✅ Project customizations kept (3 files):
   These files were only changed in your project:
   src/client/components/ui/badge.tsx
   src/client/features/auth/store.ts
   ...

⏭️  Skipped (2 files):
   src/client/features/myCustomFeature/index.ts
   ...
```

The results reflect your conflict resolution choices:
- **Override** files appear in "Applied successfully"
- **Merge** files appear in "Needs manual merge"
- **Skip** files appear in "Skipped"
- **Do nothing** files don't appear in any list

## Best Practices

### 1. Keep package.json Synced

**Always keep `package.json` in `templatePaths`.** You can add project-specific dependencies and custom scripts - the sync system uses 3-way merge to preserve them while updating template scripts.

### 2. Be Careful with Project Overrides

> ⚠️ **Important:** Only add files to `projectOverrides` when you truly need them different from the template.

**Risks of overriding files:**

1. **No updates**: Override files won't receive automatic updates from the template.

2. **Breaking changes**: If template changes depend on override files, your code may break after syncing. For example:
   - Template updates a shared component API
   - Your override file still uses the old API
   - After sync: your override file is now incompatible

3. **Hidden drift**: Over time, override files drift further from the template, making future manual merges harder.

**Before adding an override:**
- Is this file truly needs to be different?
- Can you achieve the same result by extending rather than modifying?

**Recommendation:**
- When template changes an override file, you'll see a conflict and can decide how to handle it

**Reviewing all template differences:**

Use `--diff-summary` to see ALL differences between your project and the template:

```bash
yarn sync-template --diff-summary
```

This generates `template-diff-summary.md` showing diffs for ALL files - including modified, new, and ignored files - regardless of commit history. This is a full comparison of your current project against the latest template. Review this periodically to:
- See what's different from the template
- Catch important template changes you may want to manually apply
- Understand how your project has diverged from the template

### 3. Mark Override Files

If you need to keep specific template files different in your project, add them to `projectOverrides`:

```json
{
  "projectOverrides": [
    "src/client/components/ui/badge.tsx"
  ]
}
```

**Note:** Only use this for files within `templatePaths` that you've intentionally modified.

### 4. Sync Regularly

Sync frequently to avoid large conflicts:

```bash
# Check for updates weekly or monthly
yarn sync-template --dry-run
```

### 4. Review Before Merging

Always review auto-merged changes:

```bash
git diff
```

Make sure automatic merges didn't break anything.

### 5. Test After Sync

```bash
yarn checks
yarn dev
```

## Advanced Usage

### Force Sync (With Uncommitted Changes)

```bash
yarn sync-template --force
```

⚠️ **Warning:** This bypasses the uncommitted changes check. Use with caution.

### Change Template Branch

Edit `.template-sync.json`:

```json
{
  "templateBranch": "develop"
}
```

### Override Additional Files

Add files to `projectOverrides` if you want to keep them different from template:

```json
{
  "projectOverrides": [
    "src/client/components/ui/custom-button.tsx"
  ]
}
```

**Note:** Files not in `templatePaths` are never synced, so you don't need to list them anywhere.

## Workflow Example

```bash
# 1. Check current status
git status

# 2. Commit your work
git add .
git commit -m "Feature: Add user dashboard"

# 3. Preview template updates
yarn sync-template --dry-run

# 4. Sync
yarn sync-template

# 5. Review changes
git diff

# 6. Handle conflicts (if any)
code src/some-file.ts  # Edit manually
rm src/some-file.ts.template

# 7. Test
yarn checks
yarn dev

# 8. Commit
git add .
git commit -m "Merge template updates"
```

## Troubleshooting

### "You have uncommitted changes"

```bash
# Option 1: Commit your changes
git add .
git commit -m "WIP: Current work"

# Option 2: Stash your changes
git stash
yarn sync-template
git stash pop

# Option 3: Force (not recommended)
yarn sync-template --force
```

### "Template repository not found"

Check your `.template-sync.json` and ensure `templateRepo` URL is correct.

### Too Many Conflicts

If you get many conflicts after a long time:

1. Use `--dry-run` first to understand the scope
2. Consider syncing in stages (manually cherry-pick some changes)
3. Add files to `projectOverrides` if you need to keep them different

## For Template Maintainers

### Making Template Changes

When updating the template:

1. **Document breaking changes** in commit messages
2. **Test sync** with an existing project before pushing
3. **Consider impact** on existing projects

### Testing Sync

```bash
# Create a test project
git clone <template> test-project
cd test-project
yarn init-template <template-url>

# Make some changes in test-project
# Make changes in template
# Test sync
yarn sync-template --dry-run
```

## Files Created

- `.template-sync.json` - Project config (commit this)
- `.template-sync.template.json` - Template config, synced from template (commit this)
- `*.template` - Template versions during conflicts (temporary, delete after merging)
- `.template-sync-temp/` - Temporary directory (auto-cleaned)

## Integration with CI/CD

You can automate sync checks and even auto-apply safe changes:

```yaml
# .github/workflows/check-template.yml
name: Check Template Updates

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: yarn install
      - run: yarn sync-template --dry-run
```

For automatic safe updates (creates PR if changes detected):

```yaml
# .github/workflows/auto-sync-template.yml
name: Auto Sync Template (Safe Only)

on:
  schedule:
    - cron: '0 0 1 * *'  # Monthly

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: yarn install
      - run: yarn sync-template --auto-safe-only
      - name: Create PR if changes
        uses: peter-evans/create-pull-request@v5
        with:
          title: "chore: sync template updates (safe only)"
          branch: template-sync-updates
```

## Summary

### Config Files

| File | Owner | Purpose |
|------|-------|---------|
| `.template-sync.template.json` | Template | Defines `templatePaths` and `templateIgnoredFiles` (auto-synced) |
| `.template-sync.json` | Project | Contains `projectOverrides`, sync tracking, and template repo info |

### Commands

| Command | Purpose |
|---------|---------|
| `yarn init-template <url>` | Initialize tracking in new project (SSH default) |
| `yarn init-template <url> --use-https` | Initialize with HTTPS instead of SSH |
| `yarn sync-template` | Sync updates from template (interactive) |
| `yarn sync-template --dry-run` | Preview changes |
| `yarn sync-template --force` | Force sync with uncommitted changes |
| `yarn sync-template --use-https` | Use HTTPS instead of SSH for cloning |
| `yarn sync-template --diff-summary` | Generate full diff report (all differences) |
| `yarn sync-template --init-hashes` | Initialize baseline hashes for all files (legacy) |
| `yarn sync-template --changelog` | Show template commits since last sync |
| `yarn sync-template --show-drift` | Show total project drift with file list |
| `yarn sync-template --migrate` | Migrate from legacy to Path Ownership config |
| `yarn sync-template --migration-help` | Show migration help information |

### Auto Mode Flags

For non-interactive/CI usage:

| Flag | Safe Changes | Conflicts |
|------|-------------|-----------|
| `--auto-safe-only` | ✅ Applied | ⏭️ Skipped |
| `--auto-merge-conflicts` | ✅ Applied | 🔀 Creates `.template` files |
| `--auto-override-conflicts` | ✅ Applied | 🔄 Replaced with template |
| `--auto-skip-conflicts` | ✅ Applied | ⏭️ Skipped |

### Interactive Conflict Resolution Options

When conflicts are detected in interactive mode:

| Option | Description |
|--------|-------------|
| **Override** | Replace your changes with template version |
| **Skip** | Keep your version, ignore template changes |
| **Merge** | Create `.template` file for manual merge |
| **Do nothing** | Leave file unchanged for now |

---

**Happy syncing! 🚀**

