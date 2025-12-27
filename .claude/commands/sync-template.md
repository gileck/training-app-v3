---
description: Sync updates from the template repository into your project
---

# Sync Template Updates

This command helps you sync updates from the template repository into your project. Use this after the template has been updated with improvements, bug fixes, or new features.

**Full Documentation**: [docs/template-sync/template-sync.md](docs/template-sync/template-sync.md)

## Overview

The template sync system intelligently merges updates from the template repository while preserving your project customizations. It:

- **Auto-merges** files that only changed in the template (safe)
- **Flags conflicts** when both template and project modified the same file
- **Skips** ignored files and project-specific code
- **Reports** exactly what happened

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
2. **Analyze changes** - Categorizes files into:
   - Safe changes (only template modified)
   - Potential conflicts (both template and project modified)
   - Skipped (ignored/project-specific files)
3. **Prompt for choice**:
   ```
   What would you like to do?

   [1] Safe only  - Apply only safe changes (no conflicts)
   [2] All changes - Apply all changes (may need manual merge)
   [3] Cancel     - Don't apply any changes
   ```
4. **Apply selected changes**
5. **Update config** - Saves last sync commit and date
6. **Report results** - Shows what was applied

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
SYNC RESULTS
============================================================

Auto-merged (12 files):
   src/client/components/ui/button.tsx
   src/server/middleware/auth.ts
   src/client/config/defaults.ts
   ...

Conflicts - Manual merge needed (3 files):
   src/server/index.ts
      -> Template version saved to: src/server/index.ts.template
   src/client/routes/Home/page.tsx
      -> Template version saved to: src/client/routes/Home/page.tsx.template
   package.json
      -> Template version saved to: package.json.template

Skipped (1 file):
   src/client/features/myCustomFeature/index.ts
```

**Auto-merged files**: These were safely updated. Review with `git diff`.

**Conflicts**: Files with `.template` extension need manual merging (see Step 6).

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
  ]
}
```

**Key fields**:
- `ignoredFiles`: Never touched during sync (system files, config, example features, registry files)
- `projectSpecificFiles`: Your custom code that shouldn't be overwritten

**Glob pattern support:**
Both arrays support glob patterns for flexible matching:
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

**Note:** Example features (Todos, Chat) and registry files (routes/index.ts, apis.ts, NavLinks.tsx, collections/index.ts) are ignored by default since users customize these when creating a new project from the template.

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
# Auto-merged (5 files):
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
# Conflicts (2 files):
#    src/server/index.ts.template

# Apply
yarn sync-template

# Manually merge
code src/server/index.ts  # Open both versions
# Merge the changes
rm src/server/index.ts.template

# Test and commit
yarn checks
git commit -am "Merge template updates with conflict resolution"
```

### Scenario 4: Skip Your Custom Feature

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
# Skipped (1 file):
#    src/client/features/myAwesomeFeature/index.ts
```

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

## Best Practices

1. **Sync regularly** - Monthly or quarterly to avoid large conflicts
2. **Preview first** - Always run `--dry-run` before applying
3. **Mark custom code** - Add project-specific files to config
4. **Test after sync** - Run `yarn checks` and test key features
5. **Review auto-merges** - Use `git diff` to verify changes
6. **Commit immediately** - Don't mix sync with other work

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
