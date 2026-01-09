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
│     • CONTRIBUTE → Copy project file to template (NO COMMIT)    │
│     • KEEP → Add file to projectSpecificFiles in config         │
│                                                                 │
│  4. Generate message for template agent (user copies this)      │
│                                                                 │
│  5. User goes to template repo, pastes message to agent         │
│                                                                 │
│  6. Template agent reviews and commits                          │
│                                                                 │
│  7. User runs sync-template --init-hashes to update baselines   │
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

### 1. Get all diffs using the sync tool

Run this command to get a complete diff report:

```bash
yarn sync-template --project-diffs
```

This outputs:
- Summary of files by change status
- Full diff for each file
- Change status: `project-only` | `template-only` | `both-changed` | `no-baseline`

**Change status meanings:**
- `project-only`: Only project changed this file (template unchanged) → Likely CONTRIBUTE or KEEP
- `template-only`: Only template changed (rare, usually handled by regular sync)
- `both-changed`: Both sides changed → Needs MERGE or decision
- `no-baseline`: No hash baseline, can't determine who changed → Review carefully

### 2. Load sync config for context

```bash
cat .template-sync.json
```

Check:
- `projectSpecificFiles` - files already marked as project-only

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

#### ✅ Single-message reply (bulk decisions)

After the agent finishes analyzing all files, the user can reply **once** with decisions for every file.

**Reply format:**
- One decision per line
- Start each line with the file number from `File X of N`
- Then the action: `DISCARD` / `MERGE` / `CONTRIBUTE` / `KEEP`

Example:

```
1 CONTRIBUTE
2 KEEP
3 MERGE
4 CONTRIBUTE
5 KEEP
6 CONTRIBUTE
7 CONTRIBUTE
```

**Rules:**
- File numbers must cover `1..N` (no missing numbers)
- Each file gets exactly one action
- If the user gives a partial list or an invalid action, ask a clarification question and do not execute changes yet

**Wait for user decision before proceeding to next file** (either per-file, or using the single-message reply format above).

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
# Copy project version to template (DO NOT COMMIT YET)
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

### 7. ⚠️ DO NOT COMMIT IN TEMPLATE

**Important:** Do NOT commit or push in the template repository!

The user will review the changes with the template's agent first.

Just verify the files were copied:
```bash
cd ../app-template-ai && git status
```

### 8. Generate message for template agent

**This is critical!** Generate a detailed message for the user to copy/paste to the template's agent.

Output this message in a code block so it's easy to copy:

````markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 MESSAGE FOR TEMPLATE AGENT - COPY EVERYTHING BELOW THIS LINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Incoming Contributions from [Project Name]

Files have been copied to the template for your review. Please review each change and commit if appropriate.

## Summary

| Action | Count |
|--------|-------|
| Files contributed | X |
| Files merged | Y |

## Files to Review

[For each CONTRIBUTE/MERGE file, include:]

### 1. `path/to/file.ts`

**Type:** Bug fix / Feature / Enhancement / Documentation
**What changed:** [Brief description of the change]
**Why:** [Reason this benefits the template]

**Key changes:**
```diff
[Show the most important diff hunks]
```

### 2. `path/to/another.ts`
...

## Review Instructions

Please:
1. Run `git status` to see all changed files
2. Run `git diff` to review each change
3. Verify changes are appropriate for the template (not project-specific)
4. Fix any issues you find before committing

## Suggested Commit Message

```
feat: contributions from [project-name]

- [file1]: [brief description]
- [file2]: [brief description]
```

## After Review

If changes look good:
```bash
git add -A
git commit -m "feat: contributions from [project-name]..."
git push
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
````

### 9. Show final instructions to user

```markdown
## ✅ Files Copied to Template (NOT committed)

The following files have been copied to `../app-template-ai`:
- [list contributed files]
- [list merged files]

## 📋 Next Steps

1. **Copy the message above** (everything between the ━━━ lines)
2. **Go to the template repository:**
   ```bash
   cd ../app-template-ai
   ```
3. **Open a new chat with the template's agent**
4. **Paste the message** - the agent will review and commit

## 🔄 After Template Agent Commits

Come back to this project. Your project should now be in sync!

Run `yarn sync-template` to verify - it should show no differences for the contributed files.

**If you see unexpected conflicts**, run:
```bash
yarn sync-template --init-hashes
```
This resets baselines (needed if template agent modified your contribution before committing).
```

### 10. Commit project changes (if any KEEP files)

If KEEP (ignore) files were marked, commit the config change in the PROJECT:

```bash
git add .template-sync.json
git commit -m "chore: mark project-specific files for sync ignore"
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
```

### Agent Generates Message for Template Agent:

````markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 MESSAGE FOR TEMPLATE AGENT - COPY EVERYTHING BELOW THIS LINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Incoming Contributions from training-app-v3

Files have been copied to the template for your review.

## Summary

| Action | Count |
|--------|-------|
| Files contributed | 2 |

## Files to Review

### 1. `src/apis/reports/server.ts`

**Type:** Bug fix
**What changed:** Fixed pagination offset calculation
**Why:** Page numbers are 1-indexed, not 0-indexed

```diff
-  const offset = page * limit;
+  const offset = (page - 1) * limit;
```

### 2. `docs/zustand-stores.md`

**Type:** Documentation
**What changed:** Added troubleshooting section for infinite loop error
**Why:** Common pitfall that all template users should know about

## Suggested Commit Message

```
feat: contributions from training-app-v3

- reports/server.ts: fix pagination offset (1-indexed)
- docs/zustand-stores.md: add infinite loop troubleshooting
```

## After Review

```bash
git add -A
git commit -m "feat: contributions from training-app-v3..."
git push
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
````

### Agent Shows Final Instructions:

```markdown
## ✅ Files Copied to Template (NOT committed)

- src/apis/reports/server.ts
- docs/zustand-stores.md

## 📋 Next Steps

1. **Copy the message above**
2. **Go to template:** `cd ../app-template-ai`
3. **Open new chat with template agent**
4. **Paste the message** - agent will review and commit

## 🔄 After Template Commits

Run `yarn sync-template` to verify sync is complete.
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
