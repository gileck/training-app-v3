# Template Sync Quick Start

## Scenario: You Created a New App from This Template

### Step 1: Create Your Project from Template

On GitHub:
1. Click **"Use this template"** → **"Create a new repository"**
2. Name your repo: `my-awesome-app`
3. Clone it:
```bash
git clone https://github.com/yourusername/my-awesome-app.git
cd my-awesome-app
yarn install
```

### Step 2: Initialize Template Tracking

This tells your project where the template is so it can sync updates later:

```bash
yarn init-template https://github.com/yourusername/app-template-ai.git
```

This creates `.template-sync.json`:
```json
{
  "templateRepo": "https://github.com/yourusername/app-template-ai.git",
  "templateBranch": "main",
  "baseCommit": "abc123...",
  "lastSyncCommit": "abc123...",
  "lastSyncDate": "2024-01-01T00:00:00.000Z",
  "ignoredFiles": [
    "package.json",
    "README.md",
    ".env",
    "src/client/routes/Todos",
    "src/client/routes/Chat",
    "src/apis/todos",
    "src/apis/chat",
    "..."
  ],
  "projectSpecificFiles": []
}
```

**Note:** Example features (Todos, Chat) are automatically ignored since they're just demonstrations.

**Commit this file:**
```bash
git add .template-sync.json
git commit -m "Initialize template tracking"
git push
```

### Step 3: Build Your App

Work on your app normally:
```bash
# Create your features
mkdir -p src/client/features/my-feature
# ... build your app ...

git commit -am "Add my awesome feature"
git push
```

### Step 4: Later... Template Gets Updated

Months later, the template gets improvements. Time to sync!

**Preview what would change:**
```bash
yarn sync-template --dry-run
```

Output:
```
🔄 Template Sync Tool
============================================================
📥 Cloning template from https://github.com/yourusername/app-template-ai.git...
📍 Template commit: def456...

🔍 Analyzing changes...

📝 Found 15 changed files

============================================================
📊 ANALYSIS SUMMARY
============================================================

✅ Safe changes (9 files):
   Only changed in template, no conflicts:
   • src/client/components/ui/button.tsx
   • src/client/config/defaults.ts
   • src/server/middleware/auth.ts
   ...

⚠️  Potential conflicts (2 files):
   Changed in both template and your project:
   • src/server/index.ts
   • src/client/routes/Home/page.tsx

✅ Project customizations (4 files):
   Changed only in your project (template unchanged):
   • src/client/components/ui/badge.tsx
   • src/client/features/auth/store.ts
   ...

⏭️  Skipped (0 files):
```

### Step 5: Apply Updates

```bash
yarn sync-template
```

This will:
- ✅ **Auto-merge** files that only the template changed
- ⚠️ **Ask how to handle conflicts** when both you AND template changed the same file
- ✅ **Keep your customizations** - files only you changed (template didn't touch) are preserved as-is

> **Smart Detection:** The script checks both sides before flagging a conflict. If only your project modified a file, it's recognized as a "project customization" and kept - NOT flagged as a conflict!

### Step 5b: Handle Conflicts Interactively

When you choose `[2] All changes` and there are conflicts, you'll be prompted:

```
How would you like to handle the conflicting files?

  [1] Apply the same action to all conflicting files
  [2] Choose an action for each file individually
```

For each conflict, choose an action:
- **[1] Override** - Use template version (discards your changes)
- **[2] Skip** - Keep your version (ignores template)
- **[3] Merge** - Creates `.template` file for manual merge
- **[4] Do nothing** - Leave unchanged for now

**Example:**
```
📄 File 1 of 2: src/server/index.ts

  [1] Override with template - Replace your changes with template version
  [2] Skip file              - Keep your current version, ignore template
  [3] Merge                  - Apply template changes (may cause conflicts)
  [4] Do nothing             - Leave file unchanged for now

Action for src/server/index.ts (1/2/3/4): 3
   ✓ Will merge (may conflict)
```

### Step 6: Resolve Merge Conflicts

For files where you chose "Merge", you'll see a `.template` file:

```bash
# Your version (with your changes)
cat src/server/index.ts

# Template version (with template improvements)
cat src/server/index.ts.template
```

**Manually merge them:**

1. Open both files side-by-side in your editor
2. Combine the changes you want from both
3. Save your merged version in the original file
4. Delete the `.template` file:
```bash
rm src/server/index.ts.template
```

Repeat for each `.template` file.

### Step 7: Test and Push

The sync tool **automatically commits** the applied changes:
```
📦 Committing synced files...
   ✅ Committed as abc1234
```

Now just test and push:
```bash
# Make sure everything works
yarn checks
yarn dev

# Push the sync commit
git push
```

> **Note:** If you had `.template` files for manual merges, commit those separately after resolving them.

## Example Conflict Resolution

**Your version** (`src/server/index.ts`):
```typescript
// Your custom code
app.use('/api/my-feature', myFeatureRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT);
```

**Template version** (`src/server/index.ts.template`):
```typescript
// Template improved with better error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT);

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
```

**Merged result** (keep both improvements):
```typescript
// Your custom code
app.use('/api/my-feature', myFeatureRouter);

// Template improvement
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT);

// Template improvement
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
```

## Avoiding Conflicts

### Mark Project-Specific Files

If you have files that should never be synced, add them to `.template-sync.json`:

```json
{
  "projectSpecificFiles": [
    "src/client/features/my-custom-feature",
    "src/server/my-custom-logic.ts",
    "src/apis/my-custom-api"
  ]
}
```

These files will be **skipped** during sync.

> ⚠️ **Warning:** Only skip files when you're **100% sure** you'll never want template updates for them.
> 
> **Risks:**
> - Skipped files won't get bug fixes or improvements from the template
> - If synced files depend on changes in skipped files, your code may break
> - Use `yarn sync-template --diff-summary` to review what's changing in skipped files

### Sync Regularly

The longer you wait, the more conflicts you'll have:

```bash
# Good: Sync monthly
yarn sync-template --dry-run

# Bad: Wait 2 years, get 100 conflicts
```

## Common Workflows

### Just Want to See What's New
```bash
yarn sync-template --dry-run
```

### Apply Only Safe Changes (Skip All Conflicts)
```bash
# Non-interactive: apply safe changes, skip conflicts
yarn sync-template --auto-safe-only

# Or in interactive mode, choose [1] Safe only
yarn sync-template
```

### Apply All Changes, Override Conflicts with Template
```bash
# Non-interactive: use template version for all conflicts
yarn sync-template --auto-override-conflicts
```

### Apply All Changes, Keep Your Versions for Conflicts
```bash
# Non-interactive: skip all conflicting files
yarn sync-template --auto-skip-conflicts
```

### Apply All Changes, Manual Merge for Conflicts
```bash
# Non-interactive: create .template files for manual merge
yarn sync-template --auto-merge-conflicts
```

### Ignore Template Updates for Now
Just don't run `yarn sync-template`. Your app keeps working fine.

## FAQ

**Q: Can I skip certain template changes?**  
A: Yes! When prompted, choose `[2] Skip file` to keep your version and ignore template changes.

**Q: Can I apply template changes to all conflicts at once?**  
A: Yes! Choose `[1] Apply the same action to all conflicting files` when prompted, then select the action.

**Q: What's the difference between Skip and Do nothing?**  
A: "Skip" adds the file to the skipped list (shown in results). "Do nothing" leaves the file unchanged without tracking it.

**Q: What if I don't want to sync ever?**  
A: Don't run `yarn sync-template`. The init step is optional too. Your app is independent.

**Q: Can I sync with a different branch of the template?**  
A: Yes! Edit `.template-sync.json`:
```json
{
  "templateBranch": "develop"
}
```

**Q: What if template deleted a file I'm using?**  
A: The sync system never deletes your files. Only adds/modifies.

**Q: How do I know what the template changed?**  
A: Use `yarn sync-template --diff-summary` to generate a detailed report, or check the template's git history.

## Summary

1. **Create project** from template on GitHub
2. **Initialize tracking**: `yarn init-template <template-url>`
3. **Build your app** normally
4. **Later, sync**: `yarn sync-template`
5. **Resolve conflicts** by merging `.template` files manually
6. **Test and commit**

That's it! You get template improvements while keeping your customizations. 🎉

