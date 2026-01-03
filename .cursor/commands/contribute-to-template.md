# Resolve & Sync with Template

This command resolves all differences between your project and the template, achieving full synchronization. For each differing file, you choose how to resolve it.

## Goal

**Fully sync your project with the template** by resolving every file difference. After running this command:
- Your project matches the template (no conflicts on next sync)
- Valuable changes are contributed back to the template
- Project-specific customizations are properly marked as ignored
- Both repos stay aligned

## Four Resolution Options

For each file that differs between project and template:

| Option | What Happens to Project | What Happens to Template | When to Use |
|--------|------------------------|--------------------------|-------------|
| **DISCARD** | Overwrite with template version | Nothing | Template version is better, discard your changes |
| **MERGE** | Update to merged version | Receive merged file | Both sides have valuable changes to combine |
| **CONTRIBUTE** | Keep your version | Receive your version | Your fix/improvement should go to template |
| **KEEP (ignore)** | Keep your version | Nothing (file added to `projectSpecificFiles`) | Project-specific change, don't push to template |

### Decision Guide

```
Is this a project-specific customization? (custom feature, project config, etc.)
  └─ YES → KEEP (ignore) - adds file to projectSpecificFiles, won't sync

Is the template version better or your change was temporary?
  └─ YES → DISCARD - takes template version, loses your changes

Did you fix a bug or improve something the template should have?
  └─ YES → CONTRIBUTE - pushes your version to template

Did both sides make valuable changes?
  └─ YES → MERGE - combines both, pushes merged result to template
```

### ⚠️ Important: Index/Registry Files

Files like these are **exports/registries** that MUST include your project's code:
- `src/client/features/index.ts`
- `src/apis/apis.ts`
- `src/client/routes/index.ts`
- `src/server/database/collections/index.ts`

For these files, you typically want **KEEP (ignore)** because:
- They contain project-specific exports
- Taking template version would BREAK your app
- They should be in `projectSpecificFiles` (already are in template defaults)

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Find all files that differ (project vs template)            │
│                                                                 │
│  2. For EACH differing file:                                    │
│     • Show diff (project vs template)                           │
│     • Analyze changes                                           │
│     • Recommend: DISCARD / MERGE / CONTRIBUTE / KEEP            │
│     • User decides                                              │
│                                                                 │
│  3. Execute decisions:                                          │
│     • DISCARD → Copy template file to project                   │
│     • MERGE → Create merged version, copy to both               │
│     • CONTRIBUTE → Copy project file to template                │
│     • KEEP → Add file to projectSpecificFiles in config         │
│                                                                 │
│  4. Commit changes to template (MERGE + CONTRIBUTE files)       │
│                                                                 │
│  5. Update .template-sync.json with new projectSpecificFiles    │
│                                                                 │
│  6. Result: Project fully synced with template!                 │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Template Location (Auto-detected)

The template is always at `../app-template-ai` relative to your project root.

```
/Users/you/Projects/
├── my-project/          ← Your project
└── app-template-ai/     ← Template (auto-detected)
```

**No configuration needed.**

---

## Agent Instructions

### 1. Verify template exists

```bash
TEMPLATE_PATH="../app-template-ai"
ls "$TEMPLATE_PATH" || echo "Template not found!"
```

### 2. Load sync config

```bash
cat .template-sync.json
```

Extract ignore lists:
- `ignoredFiles` - system files, skip
- `projectSpecificFiles` - project-only code, skip  
- `templateIgnoredFiles` - example code, skip

### 3. Find ALL differing files

Compare every file in project against template. A file differs if:
- Content is different (use diff or hash comparison)
- File exists in both repos
- File is NOT in any ignore list

### 4. Review EACH file with user

Present each differing file:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## File 1 of N: src/apis/reports/server.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Change Status: [Only Project Changed / Only Template Changed / Both Changed]

### Diff (Project vs Template):
```diff
[show actual diff]
```

### Analysis:
- **What project changed**: [describe]
- **What template has**: [describe]
- **Is this project-specific?**: Yes/No
- **Would this break the app if discarded?**: Yes/No

### Recommendation: DISCARD / MERGE / CONTRIBUTE / KEEP (ignore)
**Reasoning**: [explain]

### Your decision? [DISCARD / MERGE / CONTRIBUTE / KEEP]
```

**Wait for user decision before proceeding to next file.**

### 5. Execute all decisions

After all files reviewed:

**DISCARD files:**
```bash
# Copy template version to project (discards project changes)
cp ../app-template-ai/src/path/file.ts src/path/file.ts
```

**MERGE files:**
```bash
# Create merged version (agent combines changes intelligently)
# Copy merged version to BOTH:
cp merged-file.ts src/path/file.ts                    # Update project
cp merged-file.ts ../app-template-ai/src/path/file.ts # Update template
```

**CONTRIBUTE files:**
```bash
# Copy project version to template
cp src/path/file.ts ../app-template-ai/src/path/file.ts
```

**KEEP (ignore) files:**
```bash
# Add to projectSpecificFiles in .template-sync.json
# This file will be ignored in future syncs
```

### 6. Update .template-sync.json

For KEEP (ignore) files, add them to `projectSpecificFiles`:

```json
{
  "projectSpecificFiles": [
    "existing/files...",
    "src/client/features/index.ts"  // newly added
  ]
}
```

### 7. Commit template changes

For files going to template (MERGE + CONTRIBUTE):

```bash
cd ../app-template-ai
git add -A
git status
```

### 8. Generate summary

```markdown
## Resolution Summary

### 🗑️ Discarded project changes (X files):
- src/client/utils/helpers.ts - Template version preferred

### 🔀 Merged changes (Y files):
- src/apis/auth/server.ts - Combined improvements from both

### ➡️ Contributed to template (Z files):
- src/apis/reports/server.ts - Bug fix for pagination
- docs/zustand-stores.md - Valuable troubleshooting docs

### 📌 Kept as project-specific (W files):
- src/client/features/index.ts - Added to projectSpecificFiles

---

## Template Changes Ready

**Staged in `../app-template-ai`:**
- src/apis/auth/server.ts (merged)
- src/apis/reports/server.ts (contributed)

**Commit and push?** [Yes / No]
```

### 9. Commit and push

```bash
cd ../app-template-ai
git commit -m "fix: merge project contributions

- feature: added IOSAuthModal onOpenChange prop
- fix: parallel deletion in deleteAllReports
- docs: zustand infinite loop troubleshooting"
git push
```

### 10. Commit project changes

```bash
cd /path/to/project
git add .template-sync.json  # if projectSpecificFiles changed
git commit -m "chore: sync with template + mark project-specific files"
```

---

## Example Workflow

### User Says: "Sync with template"

### Agent Reviews Each File:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## File 1 of 4: src/apis/reports/server.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Change Status: Only Project Changed

### Diff:
```diff
-  const offset = page * limit;
+  const offset = (page - 1) * limit;  // Fixed: page is 1-indexed
```

### Analysis:
- **What project changed**: Fixed pagination bug (page is 1-indexed)
- **What template has**: Original buggy version
- **Is this project-specific?**: No - it's a bug fix
- **Would this break the app if discarded?**: Yes - pagination would be wrong

### Recommendation: ➡️ CONTRIBUTE
**Reasoning**: This is a bug fix that the template needs. All projects benefit.

### Your decision? [CONTRIBUTE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## File 2 of 4: src/client/features/index.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Change Status: Only Project Changed

### Diff:
```diff
+export * from './plan-data';
```

### Analysis:
- **What project changed**: Added export for project-specific `plan-data` feature
- **What template has**: No plan-data export (doesn't have this feature)
- **Is this project-specific?**: YES - plan-data is your custom feature
- **Would this break the app if discarded?**: YES - plan-data feature would stop working

### Recommendation: 📌 KEEP (ignore)
**Reasoning**: This is a registry file with project-specific exports. 
⚠️ DISCARD would BREAK your app! Add to projectSpecificFiles instead.

### Your decision? [KEEP]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## File 3 of 4: src/apis/auth/shared.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Change Status: Only Project Changed

### Diff:
```diff
-export const JWT_EXPIRES_IN = "7d";
+export const JWT_EXPIRES_IN = "3650d";  // 10 years
```

### Analysis:
- **What project changed**: Extended JWT to 10 years for PWA experience
- **What template has**: 7-day expiry (sensible default)
- **Is this project-specific?**: YES - your app's auth choice
- **Would this break the app if discarded?**: No, but users would be logged out weekly

### Recommendation: 📌 KEEP (ignore)
**Reasoning**: 7-day is a better template default. Your 10-year choice is 
project-specific. Add to projectSpecificFiles.

### Your decision? [KEEP]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## File 4 of 4: docs/zustand-stores.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Change Status: Only Project Changed

### Diff:
```diff
+### 🚨 Infinite Loop: "The result of getSnapshot should be cached"
+**Cause:** Zustand selectors returning new references...
+**Fix:** Use stable constant references...
```

### Analysis:
- **What project changed**: Added troubleshooting section for common pitfall
- **What template has**: No troubleshooting section
- **Is this project-specific?**: NO - this helps all template users
- **Would this break the app if discarded?**: No

### Recommendation: ➡️ CONTRIBUTE
**Reasoning**: Valuable documentation that all template users should have.

### Your decision? [CONTRIBUTE]
```

### Agent Executes Decisions:

```markdown
## Executing Resolutions...

### ➡️ CONTRIBUTE: src/apis/reports/server.ts
Copied to template ✓

### 📌 KEEP (ignore): src/client/features/index.ts
Added to projectSpecificFiles ✓

### 📌 KEEP (ignore): src/apis/auth/shared.ts
Added to projectSpecificFiles ✓

### ➡️ CONTRIBUTE: docs/zustand-stores.md
Copied to template ✓

---

## Resolution Complete!

| Resolution | Files |
|------------|-------|
| Discarded | 0 |
| Merged | 0 |
| Contributed to template | 2 |
| Kept as project-specific | 2 |

### Template Changes Ready

**Staged in `../app-template-ai`:**
- src/apis/reports/server.ts
- docs/zustand-stores.md

**Commit and push?** [Yes]
```

---

## Decision Criteria Quick Reference

### 🗑️ DISCARD when:
- Template version is better
- Your change was experimental/temporary
- You want to reset to template's version

### 🔀 MERGE when:
- Both sides made valuable changes
- Changes don't conflict (can be combined)
- Want best of both worlds

### ➡️ CONTRIBUTE when:
- You fixed a bug template needs
- You added a feature all projects should have
- Your improvement benefits everyone

### 📌 KEEP (ignore) when:
- Change is project-specific (custom feature, config)
- File is a registry/index that includes project code
- Taking template would BREAK your app

---

## Quick Commands

| Say This | What Happens |
|----------|--------------|
| "Sync with template" | Full resolution workflow |
| "Resolve template differences" | Same as above |
| "Show what's different" | List files without deciding |

---

## Notes

- **Registry files warning**: Files like `index.ts`, `apis.ts` often need KEEP, not DISCARD
- **Excluded automatically**: Files already in `ignoredFiles`, `projectSpecificFiles`, `templateIgnoredFiles`
- **Template path**: Always `../app-template-ai` (auto-detected)
- **KEEP updates config**: Adds file to `projectSpecificFiles` so it won't appear in future syncs
