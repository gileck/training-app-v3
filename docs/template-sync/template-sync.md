# Template Sync Guide

This template includes a powerful template sync system that allows you to merge updates from the template repository into projects created from it.

## Overview

When you create a new app from this template, you can continue to receive updates and improvements from the template while maintaining your own customizations.

## How It Works

The sync system:
1. **Compares** your project files with the latest template files
2. **Auto-merges** files that only changed in the template
3. **Flags true conflicts** only when files changed in BOTH template and project
4. **Preserves project customizations** - files you changed that the template didn't touch are NOT flagged as conflicts
5. **Skips** ignored and project-specific files

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

Edit `.template-sync.json` to specify:

```json
{
  "templateRepo": "git@github.com:yourusername/app-template-ai.git",
  "templateBranch": "main",
  "baseCommit": "abc123...",
  "lastSyncCommit": "abc123...",
  "lastSyncDate": "2024-01-01T00:00:00.000Z",
  "ignoredFiles": [
    ".template-sync.json",
    "package.json",
    "README.md",
    ".env",
    ".env.local",
    "src/client/routes/Todos",
    "src/client/routes/Chat",
    "src/apis/todos",
    "src/apis/chat",
    "src/client/routes/index.ts",
    "src/client/components/NavLinks.tsx",
    "src/apis/apis.ts",
    "src/server/database/collections/index.ts",
    "src/server/database/collections/todos",
    "src/server/database/collections/reports"
  ],
  "projectSpecificFiles": [
    "src/client/features/myCustomFeature",
    "src/server/myCustomLogic.ts"
  ]
}
```

**Key fields:**
- `ignoredFiles`: Files that should never be synced (config files, example features, registry files)
- `projectSpecificFiles`: Additional files to skip (your heavily customized code)

**Glob pattern support:**
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

**Note:** Example features (Todos, Chat) and registry files (route/API/collection registrations, navigation menus) are ignored by default since users customize these when creating a new project.

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

### 1. Keep Dependencies Separate

If you add project-specific dependencies, consider maintaining a separate list and merging `package.json` manually.

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

**Reviewing skipped file changes:**

Use `--diff-summary` to see what changes exist in skipped files:

```bash
yarn sync-template --diff-summary
```

This generates `template-diff-summary.md` showing diffs for ALL files including skipped ones. Review this periodically to catch important template changes you may want to manually apply.

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

| Command | Purpose |
|---------|---------|
| `yarn init-template <url>` | Initialize tracking in new project (SSH default) |
| `yarn init-template <url> --use-https` | Initialize with HTTPS instead of SSH |
| `yarn sync-template` | Sync updates from template (interactive) |
| `yarn sync-template --dry-run` | Preview changes |
| `yarn sync-template --force` | Force sync with uncommitted changes |
| `yarn sync-template --use-https` | Use HTTPS instead of SSH for cloning |
| `yarn sync-template --diff-summary` | Generate detailed diff report |

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

