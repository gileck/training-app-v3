# Contribute Changes to Template

This command helps you transfer bug fixes and improvements from your project back to the template repository. Use this when you've fixed something in template code and want to contribute it upstream.

## Overview

When you fix a bug or improve template code in your project, you want those changes to flow back to the template so:
1. Other projects benefit from the fix
2. Your next template sync includes the fix (avoiding conflicts)

### Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  YOUR PROJECT                         TEMPLATE REPO             │
│                                                                 │
│  1. Fix bug in template file    ───────────────────────────►   │
│     (e.g., reports UI fix)                                      │
│                                                                 │
│  2. Run this command            ───► Creates patch file         │
│                                       Copies to template path   │
│                                       Stashes project changes   │
│                                       Generates agent message   │
│                                                                 │
│  3. Copy message to template    ───► Template agent applies     │
│     agent                             patch and commits         │
│                                                                 │
│  4. Template pushes changes     ◄───────────────────────────   │
│                                                                 │
│  5. Run sync-template           ───► Changes sync cleanly!      │
│     (pop stash)                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. Template Local Path (Auto-detected)

The template is always located at `../app-template-ai` relative to your project root.

For example:
- Your project: `/Users/you/Projects/my-project`
- Template path: `/Users/you/Projects/app-template-ai`

**No configuration needed** - the command auto-detects this path.

### 2. Ensure Clean Template Repo

The template repository should have a clean working directory before applying patches.

## Process

### Step 1: Identify Template Changes

First, let's see what template files you've modified:

```bash
# Show files that differ from template (not in ignoredFiles or projectSpecificFiles)
yarn sync-template --dry-run
```

Look for files in the "Project customizations" or "Conflicts" sections - these are template files you've modified.

**Or manually check:**

```bash
# List modified files
git status

# Show diff for specific file
git diff src/apis/reports/server.ts
```

### Step 2: Review Changes to Contribute

Before contributing, review what you're sending:

```bash
# Show all your changes to template files
git diff HEAD -- <file1> <file2> ...
```

**Important**: Only contribute changes to **template files**, not:
- Project-specific config (`src/app.config.js`, etc.)
- Your custom features (`projectSpecificFiles`)
- Files in `templateIgnoredFiles` (example code)

### Step 3: Create the Patch

I'll help you create a patch file. Tell me which files to include, or I'll analyze the project to find template file changes.

**Option A: Specify files manually**
```
Create a patch for: src/apis/reports/server.ts, src/client/features/reports/hooks.ts
```

**Option B: Auto-detect template changes**
```
Analyze and create patch for all template file changes
```

### Step 4: Generate Contribution Package

Once files are identified, I will:

1. **Create patch file** in the template directory:
   ```
   ../app-template-ai/incoming-patches/project-contribution-{timestamp}.patch
   ```

2. **Generate contribution message** for the template agent (see below)

3. **Optionally stash your changes** so next sync works cleanly

### Step 5: Apply in Template

Copy the generated message to the template project's agent. The message includes:
- Summary of changes
- Patch file location
- Instructions for the template agent

### Step 6: After Template Updates

Once the template has pushed the changes:

```bash
# Pop your stashed changes (if stashed)
git stash pop

# Sync with template - should merge cleanly now!
yarn sync-template
```

---

## Agent Instructions

When the user wants to contribute changes to the template, follow these steps:

### 1. Determine template path

The template is always at `../app-template-ai` relative to the project root:

```bash
# Get project root
PROJECT_ROOT=$(pwd)

# Template path is always one level up + app-template-ai
TEMPLATE_PATH="$(dirname "$PROJECT_ROOT")/app-template-ai"

# Verify it exists
ls "$TEMPLATE_PATH"
```

### 2. Identify template file changes

Run a diff analysis to find files that:
- Are modified in the project
- Are NOT in `ignoredFiles`, `projectSpecificFiles`, or `templateIgnoredFiles`
- Exist in the template

```bash
# Get list of changed files
git diff --name-only HEAD

# Or compare against last sync
git diff --name-only {lastProjectCommit} HEAD
```

### 3. Let user select files to contribute

Show the list and ask which files to include in the patch.

### 4. Create the patch file

```bash
# Create patch for selected files
git diff HEAD -- file1.ts file2.ts > /path/to/template/incoming-patches/contribution-{date}.patch
```

### 5. Copy patch to template

```bash
# Template is always at ../app-template-ai
TEMPLATE_PATH="../app-template-ai"

# Ensure directory exists
mkdir -p "$TEMPLATE_PATH/incoming-patches"

# Copy the patch
cp contribution.patch "$TEMPLATE_PATH/incoming-patches/"
```

### 6. Optionally stash project changes

```bash
# Stash the contributed changes
git stash push -m "Contributed to template: {summary}" -- file1.ts file2.ts
```

### 7. Generate the template agent message

Create a message like this:

---

## Template Agent Message Template

```markdown
# Incoming Project Contribution

A project has contributed changes back to the template.

## Patch Location
`incoming-patches/contribution-{timestamp}.patch`

## Summary
{Brief description of what was fixed/improved}

## Files Changed
- `src/apis/reports/server.ts` - {description}
- `src/client/features/reports/hooks.ts` - {description}

## Instructions

1. **Review the patch:**
   ```bash
   cat incoming-patches/contribution-{timestamp}.patch
   ```

2. **Apply the patch:**
   ```bash
   git apply incoming-patches/contribution-{timestamp}.patch
   ```

3. **If patch fails (conflicts):**
   ```bash
   # Try with 3-way merge
   git apply --3way incoming-patches/contribution-{timestamp}.patch
   
   # Or apply manually by reading the patch
   ```

4. **Review the changes:**
   ```bash
   git diff
   yarn checks
   ```

5. **Commit and push:**
   ```bash
   git add -A
   git commit -m "fix: {description from contributor}"
   git push
   ```

6. **Clean up:**
   ```bash
   rm incoming-patches/contribution-{timestamp}.patch
   # Remove directory if empty
   rmdir incoming-patches 2>/dev/null || true
   ```

## Original Context
{Any additional context from the contributor about why this change was made}
```

---

## Example Workflow

### User's Project

```bash
# User fixed a bug in reports
git diff src/apis/reports/handlers/getReports.ts
# Shows the fix

# User runs this command
# Agent creates patch and copies to template
```

### Generated Message (copied to template)

```markdown
# Incoming Project Contribution

## Patch Location
`incoming-patches/contribution-2024-01-15-reports-fix.patch`

## Summary
Fixed pagination bug in reports API where offset was incorrectly calculated.

## Files Changed
- `src/apis/reports/handlers/getReports.ts` - Fixed offset calculation in pagination

## Instructions
1. Review: `cat incoming-patches/contribution-2024-01-15-reports-fix.patch`
2. Apply: `git apply incoming-patches/contribution-2024-01-15-reports-fix.patch`
3. Test: `yarn checks`
4. Commit: `git commit -am "fix(reports): correct pagination offset calculation"`
5. Push: `git push`
6. Cleanup: `rm incoming-patches/contribution-2024-01-15-reports-fix.patch`
```

### Template Agent

Receives the message, applies the patch, commits, and pushes.

### Back to User's Project

```bash
# Pop stashed changes
git stash pop

# Sync - changes merge cleanly!
yarn sync-template
```

---

## Troubleshooting

### "Patch does not apply cleanly"

The template may have changed since you made your fix. Options:

1. **Try 3-way merge:**
   ```bash
   git apply --3way patch-file.patch
   ```

2. **Apply manually:** Read the patch and make changes by hand

3. **Reject and redo:** If too complex, manually recreate the fix in the template

### "Template directory not found"

The template should be at `../app-template-ai`. Make sure:
1. You have the template cloned locally
2. It's in the same parent directory as your project
3. The folder is named `app-template-ai`

```bash
# Check if template exists
ls ../app-template-ai
```

### "Changes include project-specific files"

Only template files should be contributed. Remove project-specific files from the patch:
- Custom features you added
- Project config files
- Files in `projectSpecificFiles`

---

## What Should I Do?

Tell me what you want to contribute:

1. **"Contribute my reports fix"** - I'll find changes to reports files
2. **"Contribute changes to X, Y, Z files"** - I'll create patch for those files
3. **"Show what template files I've changed"** - I'll analyze and list them
4. **"Help me set up templateLocalPath"** - I'll help configure the path

Once you tell me what to contribute, I'll:
1. Create the patch file
2. Copy it to the template
3. Generate the message for the template agent
4. Optionally stash your changes
