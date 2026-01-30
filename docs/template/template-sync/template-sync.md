# Template Sync Guide

This template includes a powerful template sync system that allows you to merge updates from the template repository into projects created from it.

## Overview

When you create a new app from this template, you can continue to receive updates and improvements from the template while maintaining your own customizations.

## Two Sync Models

The sync system supports two configuration models:

### 1. Path Ownership Model (New - Recommended)

The **Path Ownership Model** uses explicit path declarations to determine what the template owns:

- **`templatePaths`**: Paths owned by the template (synced exactly, including deletions)
- **`projectOverrides`**: Files within templatePaths that the project wants to keep different

**Key behaviors:**
- Template-owned files are synced exactly (additions, modifications, AND deletions)
- If template deletes a file, it's deleted from the project
- Project overrides are kept different from template
- Clear, explicit ownership - no hash drift issues

### 2. Hash-Based Model (Legacy)

The **Hash-Based Model** uses file hashes to detect who changed what:

- **`ignoredFiles`**: Files never synced
- **`projectSpecificFiles`**: Your custom code
- **`templateIgnoredFiles`**: Template example code to skip
- **`fileHashes`**: Auto-managed baseline hashes

**Key behaviors:**
- Uses MD5 hashes to track changes
- Flags conflicts when BOTH template and project changed a file
- Never deletes files (only adds/modifies)

### Which Model Should I Use?

| Use Case | Recommended Model |
|----------|-------------------|
| New projects | **Path Ownership** (simpler, more reliable) |
| Existing projects with legacy config | Keep legacy OR migrate |
| Projects with many customizations | Hash-Based (more fine-grained control) |
| Projects that need deletion sync | **Path Ownership** (handles deletions) |

**Migration:** Run `yarn sync-template --migrate` to convert legacy config to Path Ownership model.

---

## Path Ownership Model (Recommended)

### How It Works

1. **Template paths** are synced exactly - what's in template appears in project
2. **Deletions** are synced - if template removes a file, it's removed from project
3. **Project overrides** let you keep specific files different from template
4. **package.json** uses 3-way merge to preserve project dependencies

### Configuration

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

## Hash-Based Model (Legacy)

For projects using the legacy configuration format:

### How It Works

The sync system uses **hash-based change detection** to accurately track who changed what:

1. **Stores baseline hashes** for each file at sync time
2. **Compares** current project and template hashes against the baseline
3. **Auto-merges** files that only changed in the template
4. **Flags true conflicts** only when files changed in BOTH template and project
5. **Preserves project customizations** - files you changed that the template didn't touch are NOT flagged as conflicts
6. **Skips** ignored, project-specific, and template-ignored files

### Hash-Based Change Detection

The sync tool tracks MD5 hashes of files to determine:
- **Template changed**: Template hash ≠ stored baseline → Safe to apply
- **Project changed**: Project hash ≠ stored baseline → Project customization (kept as-is)
- **Both changed**: Both hashes ≠ baseline → True conflict (needs resolution)
- **Neither changed**: Files are identical → No action needed

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

#### Legacy Hash-Based Config

```json
{
  "templateRepo": "git@github.com:yourusername/app-template-ai.git",
  "templateBranch": "main",
  "templateLocalPath": "../app-template-ai",
  "baseCommit": "abc123...",
  "lastSyncCommit": "abc123...",
  "lastSyncDate": "2024-01-01T00:00:00.000Z",
  "ignoredFiles": [
    ".template-sync.json",
    "README.md",
    ".env",
    ".env.local",
    "src/client/routes/index.ts",
    "src/client/components/NavLinks.tsx",
    "src/apis/apis.ts",
    "src/server/database/collections/index.ts"
  ],
  "projectSpecificFiles": [
    "src/client/features/myCustomFeature",
    "src/server/myCustomLogic.ts"
  ],
  "templateIgnoredFiles": [
    "src/apis/todos",
    "src/apis/chat",
    "src/client/routes/Todos",
    "src/client/routes/Chat",
    "src/client/routes/Home",
    "src/server/database/collections/todos"
  ],
  "fileHashes": {}
}
```

**Legacy key fields:**
- `templateRepo`: Remote git URL for the template (used as fallback)
- `templateLocalPath`: Local path to template repo for faster syncing (optional, see below)
- `ignoredFiles`: Files that should never be synced (config files, registry files)
- `projectSpecificFiles`: Your custom code that doesn't exist in template
- `templateIgnoredFiles`: Template example/demo code to completely ignore (never sync, never show)
- `fileHashes`: Auto-managed baseline hashes for change detection (don't edit manually)

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

## Migration: Legacy to Path Ownership

If you have a project using the legacy hash-based config, you can migrate to the Path Ownership model.

### Why Migrate?

| Issue | Legacy Model | Path Ownership Model |
|-------|-------------|---------------------|
| Deleted files | Not handled (orphan files remain) | ✅ Synced (deleted from project) |
| Conflict detection | Hash drift can cause false positives | ✅ Explicit path ownership |
| Configuration | Complex (3 ignore arrays + hashes) | ✅ Simple (2 arrays) |
| Behavior | Implicit (hash comparison) | ✅ Explicit (path declarations) |

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

### Manual Migration

Or migrate manually by editing `.template-sync.json`:

**Before (Legacy):**
```json
{
  "templateRepo": "...",
  "ignoredFiles": ["...", "..."],
  "projectSpecificFiles": ["...", "..."],
  "templateIgnoredFiles": ["...", "..."],
  "fileHashes": {"...": "..."}
}
```

**After (Path Ownership):**
```json
{
  "templateRepo": "...",
  "templatePaths": [
    "package.json",
    "tsconfig.json",
    "docs/template/**",
    "scripts/template/**",
    "src/client/components/ui/**"
  ],
  "projectOverrides": [
    "src/client/components/ui/badge.tsx"
  ],
  "overrideHashes": {}
}
```

### Migration Help

For more details on the migration process:

```bash
yarn sync-template --migration-help
```

---

**Glob pattern support (for both models):**
Both arrays support glob patterns:
- `*` - Matches any characters except `/` (within a single directory)
- `**` - Matches any characters including `/` (across directories)

**Examples:**
```json
{
  "ignoredFiles": [
    "src/client/routes/MyRoute",           // Exact directory
    "src/client/routes/Search/**",         // Everything under Search
    "src/apis/my-*.ts",                    // All files matching pattern
    "src/custom/**/*.test.ts"              // All test files in custom/
  ],
  "projectSpecificFiles": [
    "src/client/features/myCustomFeature/**",  // Entire feature
    "src/server/custom-*.ts"                   // All custom server files
  ]
}
```

### Understanding the Three Ignore Types

| Config Field | Purpose | Examples |
|--------------|---------|----------|
| `ignoredFiles` | System/config files + registry files you'll customize | `.env`, `.env.local`, `apis.ts`, `NavLinks.tsx` |
| `projectSpecificFiles` | Your custom code that doesn't exist in template | `src/client/features/myFeature` |
| `templateIgnoredFiles` | Template example/demo code you don't want | `src/apis/todos`, `src/client/routes/Chat` |

> **⚠️ CRITICAL: Never Ignore package.json**
>
> **Do NOT add `package.json` to `ignoredFiles`!** The template's `package.json` contains essential scripts for GitHub Projects workflow, template sync, agent commands, and more. Ignoring it will break these features. You can safely add custom scripts to your `package.json` - just keep it synced from the template.

**Key difference:**
- `ignoredFiles` and `projectSpecificFiles`: Files show in "Skipped" during sync
- `templateIgnoredFiles`: Files are **completely invisible** - never synced, never shown

### ⚠️ One-Time Migration for Existing Projects

> **If your project was created before commit `4b8502a` (Jan 18, 2026)**, you need to manually update 5 index files to use the new template + project pattern.

The template now splits aggregation files (like `apis.ts`, `routes/index.ts`, etc.) into two parts:
- **`.template.ts` files** - Template code (auto-syncs from template)
- **Main index files** - Your project code + imports from template

This prevents merge conflicts during template sync.

**📖 Migration Guide:** [migrate-to-split-index-files.md](migrate-to-split-index-files.md)

The migration guide provides step-by-step instructions for updating:
1. `src/apis/apis.ts`
2. `src/client/features/index.ts`
3. `src/client/components/NavLinks.tsx`
4. `src/client/routes/index.ts`
5. `src/server/database/collections/index.ts`

Since these files are in `ignoredFiles`, this one-time manual update is required to adopt the new pattern.

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

**Always keep `package.json` synced from the template.** You can add project-specific dependencies and custom scripts - the sync system will preserve them while updating template scripts. Never add `package.json` to `ignoredFiles` or you'll miss critical updates to agent commands, workflow scripts, and tooling.

### 2. Be Careful with Skipped Files

> ⚠️ **Important:** Only add files to `ignoredFiles` or `projectSpecificFiles` when you are **100% sure** you will NEVER want to receive template updates for those files.

**Risks of skipping files:**

1. **No updates**: Skipped files will NOT receive improvements, bug fixes, or security patches from the template.

2. **Breaking changes**: If template changes in synced files depend on changes in skipped files, your code may break after syncing. For example:
   - Template updates a shared component API
   - Your skipped file still uses the old API
   - After sync: your skipped file is now incompatible

3. **Hidden drift**: Over time, skipped files drift further from the template, making future manual merges harder.

**Before skipping a file, ask:**
- Is this file truly project-specific (e.g., your custom features)?
- Or is it a template file I've modified (e.g., `Layout.tsx`)?

**Recommendation:**
- For **truly project-specific files** → Add to `projectSpecificFiles` ✅
- For **template files you've customized** → Leave them syncable, handle as conflicts ⚠️

**Reviewing all template differences:**

Use `--diff-summary` to see ALL differences between your project and the template:

```bash
yarn sync-template --diff-summary
```

This generates `template-diff-summary.md` showing diffs for ALL files - including modified, new, and ignored files - regardless of commit history. This is a full comparison of your current project against the latest template. Review this periodically to:
- See what's different from the template
- Catch important template changes you may want to manually apply
- Understand how your project has diverged from the template

### 3. Mark Custom Code

Add your **truly** project-specific features to `projectSpecificFiles` in `.template-sync.json`:

```json
{
  "projectSpecificFiles": [
    "src/client/features/myFeature",
    "src/server/custom-api.ts"
  ]
}
```

**Note:** Only use this for files that don't exist in the template at all, or example files you've completely replaced.

### 3. Sync Regularly

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

### Ignore Additional Files

Add patterns to `ignoredFiles`:

```json
{
  "ignoredFiles": [
    "docs/project-specific",
    "scripts/custom-deploy.sh",
    "*.local.ts"
  ]
}
```

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
3. Mark conflicting areas as `projectSpecificFiles` if they're truly custom

### "Conflicts - no baseline" Messages

If you see many files showing as "Conflicts - no baseline":

```
⚠️  Conflicts - no baseline (8 files):
   Files differ from template with no sync history:
   • src/apis/auth/shared.ts
   ...
```

This means the sync tool doesn't have baseline hashes for these files (common for projects synced before the hash system was introduced).

**Solution:** Run `--init-hashes` to establish baselines:

```bash
yarn sync-template --init-hashes
```

After this, files you've modified will correctly show as "Project customizations" instead of conflicts.

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

- `.template-sync.json` - Configuration (commit this)
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

### Config Models

| Model | Key Fields | Behavior |
|-------|------------|----------|
| **Path Ownership** (new) | `templatePaths`, `projectOverrides` | Explicit ownership, handles deletions |
| **Hash-Based** (legacy) | `ignoredFiles`, `fileHashes` | Hash comparison, no deletions |

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

