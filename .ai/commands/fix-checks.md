---
description: Fix failing yarn checks by classifying errors as template vs project and fixing only project files
---

# Fix Checks Command

Automatically fix `yarn checks` failures by classifying errors, comparing template files with the template project, and fixing only project-owned files.

## Process Overview

Follow these steps in order:

---

## Step 1: Run Checks

- **Objective**: Identify all failing checks
- **Actions**:
  - Run: `yarn checks`
  - Capture the full output including all TypeScript errors, ESLint errors, circular dependency issues, and unused dependency issues
  - Parse the output to extract:
    - File paths with errors
    - Error types and messages
    - Line numbers where errors occur

---

## Step 2: Classify Failing Files

- **Objective**: Determine which failing files are template-owned vs project-owned
- **Actions**:
  - Read `.template-sync.template.json` to get the `templatePaths` array
  - For each failing file, check if it matches any pattern in `templatePaths`
  - Classify each file as either:
    - **Template file**: matches a pattern in `templatePaths` (e.g., `src/server/template/**`, `src/common/ai/**`, `.ai/commands/**`)
    - **Project file**: does NOT match any pattern in `templatePaths`
  - Present the classification to the user as a summary table

### Classification Rules

A file is a **template file** if its path matches ANY of the glob patterns in `templatePaths`. Common template patterns include:
- `src/server/template/**`
- `src/client/components/template/**`
- `src/client/features/template/**`
- `src/apis/template/**`
- `src/common/ai/**`
- `scripts/template/**`
- `docs/template/**`
- `config/**` (template config files)

A file is a **project file** if it does NOT match any template path pattern. These typically live in:
- `src/server/project/**` or `src/server/database/collections/project/**`
- `src/client/features/project/**`
- `src/client/routes/project/**`
- `src/apis/project/**`
- `*.project.ts` files
- Any other path not covered by `templatePaths`

---

## Step 3: Handle Template File Errors

- **Objective**: Determine if template file errors originate from the template or from project-specific differences
- **Actions**:

### 3a: Determine Template Project Location

1. Read `.template-sync.json` and check `templateLocalPath`
2. If `templateLocalPath` is set and exists on disk, use it as the template project
3. If not, check if the current project IS the template project:
   - If `child-projects.json` exists at the project root, this IS the template project
   - In this case, template files ARE project files — they can be fixed directly
   - **Skip to Step 4 and treat template files as fixable**
4. If neither, check if common template locations exist:
   - `../app-template-ai/`
   - The parent directory for a folder matching the template repo name
5. If no template project is found, inform the user and ask them to provide the path

### 3b: Compare With Template Project (only for child projects)

For each failing template file:

1. **Check if the same file exists in the template project**
2. **Run the same check on the template project version**:
   - For TypeScript errors: check if the template version has the same error
   - For ESLint errors: check if the template version has the same violation
3. **Based on comparison**:

   **If template project has the SAME error:**
   - Report to user: "Template file `{path}` has the same error in the template project — this is a template issue, not fixing here"
   - Do NOT fix these files — they will be overridden by the next template sync
   - Suggest the user fix it in the template project instead

   **If template project does NOT have the error:**
   - Investigate WHY the file fails in this project but not in the template:
     - Check for configuration differences (tsconfig, eslint config, package versions)
     - Check if the file depends on project-specific types or imports that differ
     - Check if `config/eslint/eslint.project.mjs` or `config/next/next.project.ts` introduces different rules
     - Check if `tsconfig.json` has project-specific overrides
   - Report findings to the user with the root cause
   - **IMPORTANT: Do NOT modify template files** — they will be overridden by sync
   - Instead, suggest fixes in project configuration files or project overrides

---

## Step 4: Fix Project File Errors

- **Objective**: Fix all errors in project-owned files
- **Actions**:
  - For each project file with errors:
    1. Read the file and understand the context around each error
    2. Fix the error following project guidelines from CLAUDE.md
    3. Common fixes include:
       - TypeScript: Add proper types, fix type mismatches, handle nullable values
       - ESLint: Follow the rule's intent, don't just add disable comments
       - Imports: Fix circular dependencies by restructuring imports
       - Unused deps: Remove unused dependencies from package.json
  - **Guidelines for fixes**:
    - Fix the root cause, not symptoms
    - Follow existing code patterns and conventions
    - Never add ESLint disable comments unless specifically instructed (see CLAUDE.md ESLint rules)
    - Keep changes minimal and focused on the error

---

## Step 5: Re-run Checks

- **Objective**: Verify all fixable errors are resolved
- **Actions**:
  - Run: `yarn checks`
  - If project file errors remain, go back to Step 4
  - If only template file errors remain (that were identified as template issues in Step 3), that's acceptable
  - Continue only when all project file errors are fixed

---

## Step 6: Review Changes

- **Objective**: Ensure fixes are correct and don't introduce new issues
- **Actions**:
  - Run `git diff` to review all changes made
  - Verify:
    - No template files were modified
    - Changes are minimal and focused
    - No new issues were introduced
    - Code follows project conventions
  - If any changes look wrong, revert and redo

---

## Step 7: Commit Changes

- **Objective**: Save fixes to version control
- **Actions**:
  - Stage only modified project files (NOT template files)
  - Commit with message: `fix: resolve yarn checks errors in project files`
  - Include details of what was fixed in the commit body

---

## Step 8: Summarize

- **Objective**: Provide clear report to the user
- **Actions**:
  - Present a summary with these sections:

### Summary Format

```
## Fix Checks Summary

### Project Files Fixed
- `path/to/file.ts` — [description of fix]
- `path/to/other.ts` — [description of fix]

### Template File Errors (Not Fixed)
- `path/to/template/file.ts` — [same error exists in template project / root cause of difference]

### Remaining Issues
- [Any issues that couldn't be automatically fixed]

### Checks Status
- ✅ All project file errors resolved
- ⚠️ N template file errors remaining (template project responsibility)
```

---

## Quick Checklist

- [ ] `yarn checks` run and output captured
- [ ] Failing files classified as template vs project
- [ ] Template file errors compared with template project
- [ ] Template files NOT modified (will be overridden by sync)
- [ ] All project file errors fixed
- [ ] `yarn checks` re-run and passing for project files
- [ ] Changes reviewed via `git diff`
- [ ] Changes committed with proper message
- [ ] Summary provided to user
