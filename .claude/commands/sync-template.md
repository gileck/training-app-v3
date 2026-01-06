# Sync Template Updates

This command helps you sync updates from the template repository into your project. Use this after the template has been updated with improvements, bug fixes, or new features.

📚 **Full Documentation**: [docs/template-sync.md](mdc:../../docs/template-sync.md)  
🚀 **Quick Start**: [docs/template-sync-quick-start.md](mdc:../../docs/template-sync-quick-start.md)  
📊 **Visual Guide**: [docs/template-sync-visual-guide.md](mdc:../../docs/template-sync-visual-guide.md)

## Overview

The template sync system intelligently merges updates from the template repository while preserving your project customizations. It uses **hash-based change detection** to accurately track who modified each file.

### How It Works

The sync tool stores a hash (fingerprint) of each file when synced. On the next sync, it compares:
- **Template file** vs stored hash → Did template change this file?
- **Project file** vs stored hash → Did you change this file?

This enables accurate categorization:

- ✅ **Safe changes** - Only template changed → auto-apply
- ✅ **Project customizations** - Only you changed → keep your version (no conflict!)
- ⚠️ **Conflicts** - Both changed → needs manual merge
- ⏭️ **Skipped** - Ignored or project-specific files

## Process

### Step 1: Check if Template Tracking is Initialized

First, verify that template tracking is set up:

```bash
ls -la .template-sync.json
```

**If the file exists**: You're ready to sync! Continue to Step 2.

**If the file does NOT exist**: Initialize template tracking first:

```bash
yarn init-template https://github.com/YOUR_USERNAME/app-template-ai.git
```

Replace `YOUR_USERNAME` with the actual GitHub username/org of the template repository.

This creates `.template-sync.json` which tracks:
- Template repository URL
- Last sync commit
- Ignored files (package.json, .env, etc.)
- Project-specific files to skip

### Step 2: Ensure Clean Working Directory

The sync requires a clean git state to avoid conflicts:

```bash
git status
```

**If you have uncommitted changes**:
```bash
# Option 1: Commit them
git add .
git commit -m "WIP: Current work"

# Option 2: Stash them
git stash

# Option 3: Force sync (not recommended)
yarn sync-template --force
```

### Step 3: Preview Changes (Dry Run)

**Always preview first** to see what would change:

```bash
yarn sync-template --dry-run
```

This shows:
- Which files would be auto-merged
- Which files would have conflicts
- Which files would be skipped
- No actual changes are made

### Step 4: Apply Updates

If the preview looks good, apply the changes:

```bash
yarn sync-template
```

The sync script will:

1. **Clone template** - Downloads latest version to `.template-sync-temp/`
2. **Initialize baselines** - Stores hashes for files identical to template (first sync)
3. **Analyze changes** - Uses hash comparison to categorize files:
   - ✅ **Safe changes** - Only template modified since last sync
   - ✅ **Project customizations** - Only you modified (kept automatically!)
   - ⚠️ **Conflicts** - Both template and project modified
   - ⏭️ **Skipped** - Ignored/project-specific files
4. **Prompt for choice**:
   ```
   🤔 What would you like to do?
   
   [1] Safe only  - Apply only safe changes (skip conflicts)
   [2] All changes - Apply safe + choose how to handle each conflict
   [3] Cancel     - Don't apply any changes
   ```
5. **Apply selected changes** - Stores new hashes for synced files
6. **Update config** - Saves sync commit, date, and file hashes
7. **Report results** - Shows what was applied

**Recommended workflow:**
1. First, choose `[1] Safe only` to get non-conflicting updates
2. Test those changes: `yarn checks && yarn dev`
3. If all good, run again and choose `[2] All changes` for conflicts
4. Manually merge any `.template` files

**Auto mode (skip prompts):**
```bash
yarn sync-template --auto
```

### Step 5: Review Results

The script outputs a detailed report:

```
📊 ANALYSIS SUMMARY
============================================================

✅ Safe changes - NEW since last sync (12 files):
   Only changed in template, no conflicts:
   • src/client/components/ui/button.tsx
   • src/server/middleware/auth.ts
   • src/client/config/defaults.ts
   ...

✅ Project customizations (3 files):
   Only changed in your project (will be kept):
   • src/apis/auth/shared.ts
   • src/client/features/auth/IOSAuthModal.tsx
   • src/client/routes/Settings/Settings.tsx

⚠️  Conflicts - NEW since last sync (2 files):
   Changed in both template and your project:
   • src/server/index.ts
   • src/client/routes/Home/page.tsx

⏭️  Skipped (1 file):
   src/client/features/myCustomFeature/index.ts
```

**Safe changes**: Template-only changes that can be auto-applied.

**Project customizations**: Files YOU modified but template didn't - automatically kept! (No false conflicts)

**Conflicts**: Both you and template modified - needs manual merge (see Step 6).

**Skipped files**: Configured in `.template-sync.json` as ignored or project-specific.

### Step 6: Resolve Conflicts (If Any)

For each conflict, you'll have two versions:

1. **Your version** - `src/server/index.ts` (current file)
2. **Template version** - `src/server/index.ts.template` (what template has)

**To resolve**:

1. **Read both versions**:
```bash
cat src/server/index.ts           # Your version
cat src/server/index.ts.template  # Template version
```

2. **Manually merge** - Keep the best parts from both:
   - Your custom features/logic
   - Template improvements/bug fixes
   - Use your editor's diff view or merge tool

3. **Delete the `.template` file** after merging:
```bash
rm src/server/index.ts.template
```

4. **Repeat** for all `.template` files

**Example merge**:

```typescript
// Your version (src/server/index.ts)
app.use('/api/myFeature', myFeatureRouter);
app.listen(PORT);

// Template version (src/server/index.ts.template)
app.use(errorHandler);
const server = app.listen(PORT);
process.on('SIGTERM', () => server.close());

// Merged result (keep both improvements)
app.use('/api/myFeature', myFeatureRouter);
app.use(errorHandler);
const server = app.listen(PORT);
process.on('SIGTERM', () => server.close());
```

### Step 7: Test Everything

After merging, verify everything works:

```bash
# Type check and lint
yarn checks

# Start dev server
yarn dev
```

Visit http://localhost:3000 and test key features.

### Step 8: Commit the Changes

```bash
# Review what changed
git status
git diff

# Stage all changes
git add .

# Commit
git commit -m "Merge template updates"

# Push
git push
```

## Configuration

Edit `.template-sync.json` to customize sync behavior:

```json
{
  "templateRepo": "https://github.com/you/app-template-ai.git",
  "templateBranch": "main",
  "lastSyncCommit": "abc123...",
  "lastSyncDate": "2024-01-01T00:00:00.000Z",
  
  // Files to NEVER sync (always ignore)
  "ignoredFiles": [
    "package.json",
    "README.md",
    ".env",
    ".env.local",
    "node_modules",
    "dist",
    ".git",
    // Example features (not needed in new projects)
    "src/client/routes/Todos",
    "src/client/routes/Chat",
    "src/apis/todos",
    "src/apis/chat",
    "src/client/features/todos",
    "src/client/features/chat",
    // Registry/index files (users customize these)
    "src/client/routes/index.ts",
    "src/client/components/NavLinks.tsx",
    "src/apis/apis.ts",
    "src/server/database/collections/index.ts",
    "src/server/database/collections/todos",
    "src/server/database/collections/reports"
  ],
  
  // Your custom code (skip even if exists in template)
  "projectSpecificFiles": [
    "src/client/features/myCustomFeature",
    "src/apis/myCustomAPI",
    "src/server/myCustomLogic.ts"
  ],
  
  // Template example/demo files to completely ignore (never sync, never show)
  "templateIgnoredFiles": [
    "src/apis/todos",
    "src/client/routes/Todos",
    "src/client/features/todos",
    "src/server/database/collections/todos",
    "src/apis/chat",
    "src/client/routes/Chat",
    "src/client/features/chat"
  ],
  
  // Auto-managed: Hash of each file at last sync (DO NOT EDIT)
  "fileHashes": {
    "src/client/components/ui/button.tsx": "a1b2c3d4...",
    "src/server/middleware/auth.ts": "e5f6g7h8..."
  }
}
```

**Key fields**:
- `ignoredFiles`: Never touched during sync (system files, config, example features, registry files)
- `projectSpecificFiles`: Your custom code that shouldn't be overwritten
- `templateIgnoredFiles`: **Template example/demo code** - Files in the template that should be completely ignored (never synced, never shown as differences). Perfect for example code that projects delete after cloning.
- `fileHashes`: **Auto-managed** - Stores content hash of each synced file for accurate change detection

**Glob pattern support:**
All three arrays (`ignoredFiles`, `projectSpecificFiles`, `templateIgnoredFiles`) support glob patterns:
- `*` - Matches any characters except `/` (single directory level)
- `**` - Matches any characters including `/` (multiple directory levels)

**Examples:**
```json
"projectSpecificFiles": [
  "src/client/features/myFeature/**",    // Entire feature directory
  "src/server/custom-*.ts",              // All custom-*.ts files
  "src/apis/special/**/*.ts"             // All .ts files in special/
]
```

**Understanding the three ignore types:**

| Config Field | Purpose | When to Use |
|--------------|---------|-------------|
| `ignoredFiles` | System files never synced | `package.json`, `.env`, `node_modules`, registry files |
| `projectSpecificFiles` | Your custom code | Custom features, APIs you've added to the project |
| `templateIgnoredFiles` | Template demo/example code | Todos, Chat examples - delete after clone, forget forever |

**Note:** Example features (Todos, Chat) are commonly added to `templateIgnoredFiles` since users typically delete these after cloning and don't want to see them in sync diffs.

## Common Scenarios

### Scenario 1: First Time Syncing

```bash
# 1. Check current status
git status  # Should be clean

# 2. Preview
yarn sync-template --dry-run

# 3. Apply
yarn sync-template

# 4. No conflicts expected (first sync)
# 5. Test and commit
yarn checks
git commit -am "Initial template sync"
```

### Scenario 2: Template Added New Components

```bash
# Preview shows new files
yarn sync-template --dry-run

# Output:
# ✅ Auto-merged (5 files):
#    src/client/components/ui/new-component.tsx
#    ...

# Apply
yarn sync-template

# All auto-merged, no conflicts!
git commit -am "Add new template components"
```

### Scenario 3: Both Modified Core Files

```bash
# Preview shows conflicts
yarn sync-template --dry-run

# Output:
# ✅ Safe changes - NEW since last sync (5 files):
#    ...
# ✅ Project customizations (2 files):
#    src/apis/auth/shared.ts  (YOUR changes kept!)
#    src/client/features/auth/IOSAuthModal.tsx
# ⚠️ Conflicts - NEW since last sync (1 file):
#    src/server/index.ts  (BOTH you and template changed)

# Apply
yarn sync-template

# Your customizations are automatically kept!
# Only manually merge the actual conflicts:
code src/server/index.ts  # Open both versions
# Merge the changes
rm src/server/index.ts.template

# Test and commit
yarn checks
git commit -am "Merge template updates with conflict resolution"
```

### Scenario 4: Your Changes Are Automatically Preserved

```bash
# You modified some files, template didn't change them
yarn sync-template --dry-run

# Output shows your changes are SAFE:
# ✅ Safe changes - NEW since last sync (3 files):
#    src/client/config/defaults.ts  (template updated)
#    ...
# 
# ✅ Project customizations (2 files):
#    Only changed in your project (will be kept):
#    • src/apis/auth/shared.ts       (YOU changed, kept!)
#    • src/client/routes/Settings.tsx (YOU changed, kept!)

# Apply - your customizations are preserved automatically!
yarn sync-template
# No conflicts for files only YOU modified
```

### Scenario 5: Skip Your Custom Feature

```bash
# Edit config
code .template-sync.json

# Add to projectSpecificFiles:
{
  "projectSpecificFiles": [
    "src/client/features/myAwesomeFeature"
  ]
}

# Now sync
yarn sync-template

# Output:
# ⏭️ Skipped (1 file):
#    src/client/features/myAwesomeFeature/index.ts
```

### Scenario 6: Ignore Template Example Code (Todos, Chat)

After cloning a project, you deleted the example Todos and Chat features. Now during sync, you don't want to see them as "missing" or be prompted to add them back:

```bash
# Edit config
code .template-sync.json

# Add to templateIgnoredFiles:
{
  "templateIgnoredFiles": [
    "src/apis/todos",
    "src/client/routes/Todos",
    "src/client/features/todos",
    "src/server/database/collections/todos",
    "src/apis/chat",
    "src/client/routes/Chat",
    "src/client/features/chat"
  ]
}

# Now sync - these files are completely invisible
yarn sync-template

# Output: No mention of Todos or Chat at all!
# ✅ Safe changes - NEW since last sync (5 files):
#    src/client/components/ui/button.tsx
#    ...
```

Template-ignored files:
- Won't appear as "new in template" (even if you deleted them)
- Won't appear in diff summaries
- Won't be synced ever
- Perfect for demo/example code you don't need

## Troubleshooting

### "You have uncommitted changes"

**Solution**: Commit or stash your changes first.

```bash
git add .
git commit -m "WIP: Current work"
# OR
git stash
```

### "Template repository not found"

**Solution**: Check `.template-sync.json` has correct `templateRepo` URL.

```bash
cat .template-sync.json
# Update the URL if needed
```

### Too Many Conflicts

**Solution**: 
1. Use `--dry-run` first to understand scope
2. Consider syncing in smaller steps
3. Mark highly customized files as `projectSpecificFiles`

### Lost During Conflict Resolution

**Solution**: The template version is always saved with `.template` extension. You can always:

```bash
# See your version
cat src/file.ts

# See template version
cat src/file.ts.template

# Start over by restoring original
git checkout src/file.ts
```

### Files Showing as "Conflicts - no baseline"

**Cause**: These files differ from template but have no sync history (common on first sync or for files that were never tracked).

**Solution**: 
1. For first sync, this is expected - choose how to handle each file
2. After resolving, future syncs will track changes properly
3. The sync tool now stores file hashes to prevent this in future syncs

### My Changes Were Incorrectly Overwritten

**Cause**: In older versions, the sync tool could incorrectly classify project changes as "safe to apply".

**Solution**: 
1. Update to the latest sync-template.ts which uses hash-based change detection
2. Files you modified will now show as "Project customizations" (kept automatically)
3. Only files where BOTH you and template changed will show as conflicts

## Best Practices

1. **Sync regularly** - Monthly or quarterly to avoid large conflicts
2. **Preview first** - Always run `--dry-run` before applying
3. **Mark custom code** - Add project-specific files to config
4. **Test after sync** - Run `yarn checks` and test key features
5. **Review auto-merges** - Use `git diff` to verify changes
6. **Commit immediately** - Don't mix sync with other work
7. **Don't edit fileHashes** - The `fileHashes` field is auto-managed for change tracking

## Related Documentation

- 📚 [Template Sync Guide](mdc:../../docs/template-sync.md) - Complete reference
- 🚀 [Quick Start](mdc:../../docs/template-sync-quick-start.md) - Step-by-step tutorial
- 📊 [Visual Guide](mdc:../../docs/template-sync-visual-guide.md) - Workflow diagrams
- 🔄 [Comparison](mdc:../../docs/template-sync-comparison.md) - vs. git fork/subtree
- 🔧 [Implementation](mdc:../../docs/template-sync-implementation.md) - Technical details
- ✅ [New Project Checklist](mdc:../../NEW-PROJECT-CHECKLIST.md) - Initial setup

## What Should I Do?

Ask the user what they need:

1. **First time setup**: Guide them through `yarn init-template`
2. **Preview updates**: Run `yarn sync-template --dry-run` and explain results
3. **Apply updates**: Run `yarn sync-template` and help with conflicts
4. **Configure sync**: Edit `.template-sync.json` to add ignores/project files
5. **Resolve conflicts**: Help merge `.template` files manually

---

**Ready to sync?** Let me know if you want to:
- Preview what would change (`--dry-run`)
- Apply the updates
- Configure what files to skip
- Resolve conflicts from a previous sync

