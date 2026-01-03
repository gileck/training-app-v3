# Resolve & Sync with Template

This command resolves all differences between your project and the template, achieving full synchronization. For each differing file, you choose how to resolve it.

## Goal

**Fully sync your project with the template** by resolving every file difference. After running this command:
- Your project matches the template (no conflicts on next sync)
- Valuable changes are contributed back to the template
- Both repos stay aligned

## Three Resolution Options

For each file that differs between project and template:

| Option | Description | Project Action | Template Action |
|--------|-------------|----------------|-----------------|
| **TAKE TEMPLATE** | Discard local changes | Overwrite with template version | None |
| **MERGE** | Combine both changes | Update to merged version | Receive merged file |
| **TAKE PROJECT** | Keep your version | Keep as-is | Receive your version |

### When to Use Each

```
TAKE TEMPLATE  → Template code is good enough, your changes aren't needed
MERGE          → Both sides have valuable changes that should be combined
TAKE PROJECT   → Your version is better, template should adopt it
```

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Find all files that differ (project vs template)            │
│                                                                 │
│  2. For EACH differing file:                                    │
│     • Show diff (project vs template)                           │
│     • Analyze changes                                           │
│     • Recommend: TAKE TEMPLATE / MERGE / TAKE PROJECT           │
│     • User decides                                              │
│                                                                 │
│  3. Execute decisions:                                          │
│     • TAKE TEMPLATE → Copy template file to project             │
│     • MERGE → Create merged version, copy to both               │
│     • TAKE PROJECT → Copy project file to template              │
│                                                                 │
│  4. Generate patch for template (MERGE + TAKE PROJECT files)    │
│                                                                 │
│  5. Result: Project fully synced with template!                 │
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

```bash
# For each file in project (excluding ignore lists)
# Compare with template version
diff -q "project/path/file.ts" "template/path/file.ts"
```

### 4. Categorize each differing file

For each file, determine:
- **Only project changed**: Template baseline matches stored hash, project differs
- **Only template changed**: Project matches baseline, template differs  
- **Both changed**: Neither matches baseline (conflict)

### 5. Review EACH file with user

Present each differing file:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## File 1 of N: src/apis/reports/server.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Change Status: [Only Project Changed / Only Template Changed / Both Changed]

### Diff (Project ← → Template):
```diff
[show actual diff between project and template versions]
```

### Analysis:
- **Project changes**: [describe what project changed and why]
- **Template changes**: [describe what template changed, if any]
- **Recommendation**: TAKE TEMPLATE / MERGE / TAKE PROJECT
- **Reasoning**: [explain recommendation]

### Your decision? [TAKE TEMPLATE / MERGE / TAKE PROJECT]
```

**Wait for user decision before proceeding to next file.**

### 6. Execute all decisions

After all files reviewed:

**TAKE TEMPLATE files:**
```bash
# Copy template version to project
cp ../app-template-ai/src/path/file.ts src/path/file.ts
```

**MERGE files:**
```bash
# Create merged version (agent combines changes intelligently)
# Then copy merged version to BOTH:
cp merged-file.ts src/path/file.ts                    # Update project
cp merged-file.ts ../app-template-ai/src/path/file.ts # Update template
```

**TAKE PROJECT files:**
```bash
# Copy project version to template
cp src/path/file.ts ../app-template-ai/src/path/file.ts
```

### 7. Update template repo

For files going to template (MERGE + TAKE PROJECT):

```bash
cd ../app-template-ai

# Stage changes
git add -A

# Show what will be committed
git status
git diff --cached
```

### 8. Generate summary and commit message

```markdown
## Resolution Summary

### ↩️ Took template version (X files):
- src/client/utils/helpers.ts - Template version preferred

### 🔀 Merged changes (Y files):
- src/apis/auth/server.ts - Combined auth improvements from both

### ➡️ Contributed to template (Z files):  
- src/apis/reports/server.ts - Bug fix for pagination

---

## Template Commit

The following changes are staged in `../app-template-ai`:

**Files changed:**
- src/apis/auth/server.ts (merged)
- src/apis/reports/server.ts (from project)

**Suggested commit message:**
```
fix: merge project contributions

- auth/server.ts: combined auth improvements
- reports/server.ts: fixed pagination offset
```

**Ready to commit?** [Yes / No / Review changes first]
```

### 9. Commit and push template changes

```bash
cd ../app-template-ai
git commit -m "fix: merge project contributions"
git push
```

### 10. Update project baseline hashes

After syncing, update `.template-sync.json` fileHashes so next sync shows no differences.

---

## Example Workflow

### User Says: "Sync with template"

### Agent Reviews Each File:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## File 1 of 3: src/apis/reports/server.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Change Status: Only Project Changed

### Diff:
```diff
@@ -45,7 +45,7 @@
 const getReports = async (params) => {
-  const offset = page * limit;
+  const offset = (page - 1) * limit;  // Fixed: page is 1-indexed
   const reports = await db.find().skip(offset).limit(limit);
```

### Analysis:
- **Project changes**: Fixed pagination bug (page is 1-indexed)
- **Template changes**: None
- **Recommendation**: ➡️ TAKE PROJECT
- **Reasoning**: This is a clear bug fix that template needs

### Your decision? [TAKE PROJECT]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## File 2 of 3: src/apis/auth/server.ts  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Change Status: Both Changed

### Diff:
```diff
@@ -12,8 +12,10 @@
 // Project version:
+import { validateSession } from './utils';
 export async function authenticate(token: string) {
+  await validateSession(token);
   // ...
 }

// Template version:
+import { rateLimit } from '../middleware';
 export async function authenticate(token: string) {
+  await rateLimit();
   // ...
 }
```

### Analysis:
- **Project changes**: Added session validation
- **Template changes**: Added rate limiting
- **Recommendation**: 🔀 MERGE
- **Reasoning**: Both changes are valuable - combine them

### Your decision? [MERGE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## File 3 of 3: src/client/utils/formatDate.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Change Status: Only Project Changed

### Diff:
```diff
@@ -5,7 +5,9 @@
-export function formatDate(date: Date): string {
+export function formatDate(date: Date | string): string {
+  // Allow string input for convenience
+  const d = typeof date === 'string' ? new Date(date) : date;
```

### Analysis:
- **Project changes**: Added string input support
- **Template changes**: None
- **Recommendation**: ↩️ TAKE TEMPLATE  
- **Reasoning**: Minor convenience change, template's stricter typing is better

### Your decision? [TAKE TEMPLATE]
```

### Agent Executes Decisions:

```markdown
## Executing Resolutions...

### ↩️ TAKE TEMPLATE: src/client/utils/formatDate.ts
Copied template version to project ✓

### 🔀 MERGE: src/apis/auth/server.ts
Created merged version with both rate limiting and session validation ✓
Updated project file ✓
Updated template file ✓

### ➡️ TAKE PROJECT: src/apis/reports/server.ts
Copied project version to template ✓

---

## Resolution Complete!

| Resolution | Files |
|------------|-------|
| Took template | 1 |
| Merged | 1 |
| Contributed to template | 1 |

### Template Changes Ready

**Staged in `../app-template-ai`:**
- src/apis/auth/server.ts (merged)
- src/apis/reports/server.ts (from project)

**Commit and push?** [Yes]
```

### Agent Commits Template:

```bash
cd ../app-template-ai
git add -A
git commit -m "fix: sync with project contributions

- auth/server.ts: merged rate limiting + session validation
- reports/server.ts: fixed pagination offset bug"
git push
```

### Final Status:

```markdown
## ✅ Sync Complete!

Your project is now fully synchronized with the template.

**Changes made to your project:**
- 1 file reverted to template version
- 1 file updated with merged changes

**Changes pushed to template:**
- 2 files updated and pushed

**Next sync will show:** 0 differences
```

---

## Decision Criteria

### ↩️ TAKE TEMPLATE when:
- Your changes were experimental/temporary
- Template version is cleaner or better
- Changes are project-specific (shouldn't go to template)
- Formatting/cosmetic differences only

### 🔀 MERGE when:
- Both sides have valuable, non-conflicting changes
- Template added feature A, you added feature B
- Changes can be combined intelligently

### ➡️ TAKE PROJECT when:
- You fixed a bug that template needs
- You improved something template should adopt
- Your version is clearly better
- Security or performance fix

---

## Quick Commands

| Say This | What Happens |
|----------|--------------|
| "Sync with template" | Full resolution workflow |
| "Resolve template conflicts" | Same as above |
| "Show template differences" | List files without deciding |

---

## Notes

- **Excluded automatically**: `ignoredFiles`, `projectSpecificFiles`, `templateIgnoredFiles`
- **Template path**: Always `../app-template-ai` (auto-detected)
- **After sync**: Both repos aligned, no conflicts on future syncs
- **MERGE requires judgment**: Agent combines changes intelligently, review the result
