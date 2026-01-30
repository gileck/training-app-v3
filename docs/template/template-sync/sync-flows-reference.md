# Template Sync Flows Reference

This document describes all possible sync scenarios and how they are handled.

---

## Quick Reference Table

| Scenario | Detection | Action | User Options |
|----------|-----------|--------|--------------|
| New file from template | In template, not in project | **COPY** | None (automatic) |
| Identical file | Hashes match | **SKIP** | None (automatic) |
| Diverged file | Modified, not in overrides | **DIVERGED** | Override / Keep / Merge |
| Conflict | In overrides, template changed | **CONFLICT** | Override / Skip |
| Override unchanged | In overrides, template same | **SKIP** | None (automatic) |
| Deleted from template | In project, not in template | **DELETE** | None (automatic) |
| package.json | Always | **MERGE** | None (3-way merge) |

---

## Detailed Flow Descriptions

### 1. New File from Template

**Detection:**
- File exists in template
- File does NOT exist in project
- File is NOT in `projectOverrides`

**Action:** `COPY`

**Result:** File is copied from template to project.

**Display:**
```
✨ src/new-file.ts
```

---

### 2. Identical File (Already Up to Date)

**Detection:**
- File exists in both template and project
- File hashes are identical
- File is NOT in `projectOverrides`

**Action:** `SKIP`

**Result:** No action needed. File is already in sync.

**Display:** (only with `--verbose`)
```
✅ src/file.ts - Already up to date
```

---

### 3. Diverged File (Project Modified Without Override)

**Detection:**
- File exists in both template and project
- File hashes are DIFFERENT
- File is NOT in `projectOverrides`

**Action:** `DIVERGED` - Requires user decision

**Why this matters:** Your project has modified a template-owned file. Without intervention, your changes would be silently overwritten.

**Interactive Options:**

| Option | Key | What Happens |
|--------|-----|--------------|
| **Override** | 1 | Replace with template version. Your changes are lost. |
| **Keep** | 2 | Keep your version. File is added to `projectOverrides`. |
| **Merge** | 3 | Creates `.template` file for manual merge. File is added to `projectOverrides`. |

**Display:**
```
🔶 Diverged - Need Decision (1):
   🔶 src/client/components/ui/button.tsx
   ℹ️  These files were modified in your project but not added to projectOverrides

   File: src/client/components/ui/button.tsx
   Your project has modified this template file.

   Options:
     1. Override - Replace with template version (lose your changes)
     2. Keep - Keep your version and add to projectOverrides
     3. Merge - Create .template file for manual merge, add to overrides

   Choose [1/2/3] (default: 2):
```

**Auto Mode Behavior:**

| Flag | Diverged Files Handling |
|------|------------------------|
| `--auto-safe-only` | Skip (no changes, no override added) |
| `--auto-override-conflicts` | Override with template version |
| `--auto-skip-conflicts` | Keep project version, add to overrides |

---

### 4. Conflict (Override File with Template Changes)

**Detection:**
- File exists in both template and project
- File IS in `projectOverrides`
- Template has changed since last sync (hash differs from `overrideHashes`)

**Action:** `CONFLICT` - Requires user decision

**Why this matters:** You intentionally customized this file (it's in overrides), but the template also changed it. You need to decide which version to keep or merge manually.

**Interactive Options:**

| Option | What Happens |
|--------|--------------|
| **Override** | Replace with template version. Remove from `projectOverrides`. |
| **Skip** | Keep your version. Update baseline hash in `overrideHashes`. |

**Display:**
```
⚠️  Conflicts (1):
   ⚠️  src/client/components/ui/button.tsx - Project override, but template changed this file

   File: src/client/components/ui/button.tsx
   Reason: Project override, but template changed this file

   Override with template version? [y/N]
```

**Auto Mode Behavior:**

| Flag | Conflict Handling |
|------|-------------------|
| `--auto-safe-only` | Skip all conflicts |
| `--auto-override-conflicts` | Override with template |
| `--auto-skip-conflicts` | Keep project version |
| `--auto-merge-conflicts` | Create `.template` files |

---

### 5. Override Unchanged (Template Didn't Change)

**Detection:**
- File exists in both template and project
- File IS in `projectOverrides`
- Template has NOT changed since last sync (hash matches `overrideHashes`)

**Action:** `SKIP`

**Result:** Your customized version is preserved. No action needed.

**Display:**
```
⏭️  src/client/components/ui/button.tsx - Project override, template unchanged
```

---

### 6. File Deleted from Template

**Detection:**
- File exists in project
- File does NOT exist in template
- File path matches `templatePaths` pattern
- File is NOT in `projectOverrides`

**Action:** `DELETE`

**Result:** File is deleted from project (template removed it).

**Display:**
```
🗑️  src/old-file.ts
```

**Exception:** If file IS in `projectOverrides`, it's kept (you explicitly want to keep it).

---

### 7. package.json (Always Merged)

**Detection:**
- File is `package.json`

**Action:** `MERGE` (3-way merge)

**Result:**
- Template dependencies/scripts are added
- Project-specific dependencies/scripts are preserved
- Conflicts in same keys use template version

**Optimization:** If merge would produce no changes, file is skipped.

**Display:**
```
🔀 package.json - merged
✅ Auto-merged from template: dependencies (deep merged)
```

---

## Configuration Reference

### `.template-sync.json` Structure

```json
{
  "templateRepo": "git@github.com:user/template.git",
  "templateBranch": "main",
  "templateLocalPath": "../template",
  "lastSyncCommit": "abc123",
  "lastSyncDate": "2026-01-30T10:00:00.000Z",

  "templatePaths": [
    "package.json",
    "src/client/components/ui/**",
    "src/client/features/index.ts",
    "src/client/features/index.template.ts"
  ],

  "projectOverrides": [
    "src/client/components/ui/custom-button.tsx"
  ],

  "overrideHashes": {
    "src/client/components/ui/custom-button.tsx": "abc123..."
  }
}
```

### Key Fields

| Field | Purpose |
|-------|---------|
| `templatePaths` | Glob patterns for files owned by template |
| `projectOverrides` | Files within templatePaths that project wants to customize |
| `overrideHashes` | Template hashes at last sync (for conflict detection) |

---

## Auto Mode Flags Summary

| Flag | Safe Changes | Diverged | Conflicts |
|------|--------------|----------|-----------|
| `--auto-safe-only` | Applied | Skipped | Skipped |
| `--auto-override-conflicts` | Applied | Override | Override |
| `--auto-skip-conflicts` | Applied | Keep + add override | Keep |
| `--auto-merge-conflicts` | Applied | N/A | Create `.template` |

---

## Best Practices

### When to Add to `projectOverrides`

Add a file to `projectOverrides` when:
- You need to customize a template file permanently
- Your changes are project-specific and won't benefit other projects
- You're prepared to handle conflicts when template updates that file

### When NOT to Add to `projectOverrides`

Don't use overrides for:
- Bug fixes (contribute to template instead)
- Improvements that benefit all projects (contribute to template)
- Temporary debugging changes (they'll be lost on next sync anyway)

### Handling Diverged Files

If you see diverged files during sync:

1. **Intentional changes?** → Choose "Keep" to add to overrides
2. **Accidental changes?** → Choose "Override" to restore template version
3. **Need both versions?** → Choose "Merge" to manually combine changes

### After "Merge" Option

When you choose "Merge", a `.template` file is created:
1. Open both files side by side
2. Manually merge the changes you want to keep
3. Delete the `.template` file when done
4. The original file is now in `projectOverrides`

---

## Troubleshooting

### "Why did my changes disappear?"

Your file was probably not in `projectOverrides`. Next time:
- Add the file to `projectOverrides` before syncing, OR
- Use interactive mode and choose "Keep" when prompted

### "Why is this file showing as diverged?"

You modified a template-owned file without adding it to `projectOverrides`. Choose:
- "Keep" to preserve your changes and add to overrides
- "Override" if you want the template version

### "How do I know what's in templatePaths?"

Run `yarn sync-template --dry-run` to see what files would be affected.

### "Can I undo an override?"

Yes:
1. Remove the file from `projectOverrides`
2. Remove the hash from `overrideHashes`
3. Run `yarn sync-template` - template version will be restored
