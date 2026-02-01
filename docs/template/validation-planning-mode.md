---
title: Validation & Quality Checks
description: Code validation and linting requirements. Use this before completing any work.
summary: "**CRITICAL: Always run `yarn checks` before completing work.** Runs both TypeScript and ESLint checks, shows ALL errors at once. Must pass with 0 errors before committing, creating PRs, or deploying."
priority: 1
---

# Validation & Quality Checks - Planning Mode Guide

This document provides detailed guidance on validation and quality checks, with special focus on planning mode workflows.

> **Note:** This is the extended version. See CLAUDE.md for a concise summary.

---

## Critical Rule

**CRITICAL: Always run `yarn checks` before completing work.**

This applies to ALL work, regardless of scope or type. No exceptions.

---

## For Claude Code (Planning Mode)

When working in planning mode, **ALWAYS** include a final task in your plan to run `yarn checks`:

```markdown
## Implementation Plan

1. [Task 1: Implementation step]
2. [Task 2: Implementation step]
3. [Task 3: Implementation step]
4. **Run `yarn checks` and fix any TypeScript/ESLint errors** ⚠️ REQUIRED
```

### Why This Matters

Planning mode is where implementation strategies are designed. Including validation as a planned task ensures:

1. **Type Safety:** All TypeScript types are validated before completion
2. **Code Quality:** ESLint catches patterns and anti-patterns early
3. **Sync Safety:** Prevents breaking changes from being synced to child projects
4. **Clean State:** Validates codebase is in a deployable state
5. **Accountability:** Makes validation an explicit, tracked requirement

### Common Planning Mode Mistakes

**❌ BAD - No validation task:**
```markdown
## Implementation Plan
1. Create new API endpoint
2. Add React components
3. Update routes
```

**✅ GOOD - Includes validation:**
```markdown
## Implementation Plan
1. Create new API endpoint
2. Add React components
3. Update routes
4. Run `yarn checks` and fix any errors
```

---

## General Development

### When to Run Checks

**Before any of these actions:**

| Action | Why Checks Matter |
|--------|-------------------|
| ✅ Committing code | Prevents broken commits in history |
| ✅ Creating pull requests | Ensures PR passes CI checks |
| ✅ Syncing to child projects | Prevents propagating breaks |
| ✅ Deploying to production | Catches issues before users see them |
| ✅ Switching branches | Ensures clean state before context switch |
| ✅ Merging branches | Validates integration success |

### How to Run Checks

```bash
yarn checks
```

This command runs:
1. **TypeScript compilation** (`yarn ts`) - Type checking
2. **ESLint** (`yarn lint`) - Code quality and patterns

### Expected Output

**✅ Success:**
```
$ yarn checks
$ yarn ts
$ tsc --noEmit
✔ No TypeScript errors

$ yarn lint
✔ No ESLint warnings or errors
```

**❌ Failure:**
```
$ yarn checks
$ yarn ts
$ tsc --noEmit
src/apis/todos/client.ts:15:7 - error TS2322: Type 'string' is not assignable to type 'number'.
error Command failed with exit code 2.
```

---

## Error Resolution Workflow

When `yarn checks` fails, follow this systematic approach:

### Step 1: Fix TypeScript Errors First

**Why first:** Type safety is the foundation. Other errors may be false positives if types are wrong.

```bash
yarn ts
```

**Common TypeScript Errors:**

1. **Type mismatches:** `Type 'X' is not assignable to type 'Y'`
   - Fix: Update types or add proper type assertions

2. **Missing properties:** `Property 'foo' is missing`
   - Fix: Add the property or make it optional

3. **Circular dependencies:** `Cannot access 'X' before initialization`
   - Fix: Reorganize imports to break the cycle

4. **Any types:** ESLint will catch these, but TS won't
   - Fix: Replace `any` with proper types

### Step 2: Fix ESLint Errors Second

**Why second:** Code quality issues are easier to fix when types are correct.

```bash
yarn lint
```

**Common ESLint Errors:**

1. **Unused variables:** `'foo' is defined but never used`
   - Fix: Remove the variable or use it

2. **Missing dependencies:** `React Hook useEffect has a missing dependency`
   - Fix: Add to dependency array or use useCallback

3. **Direct zustand imports:** Custom rule blocks direct zustand
   - Fix: Use `createStore` factory from `@/client/stores`

4. **Async errors:** `Promise returned is ignored`
   - Fix: Add `await` or `.catch()` handler

### Step 3: Re-run Until Clean

```bash
yarn checks
```

Keep fixing and re-running until you see:
```
✔ No TypeScript errors
✔ No ESLint warnings or errors
```

**Don't proceed until this passes!**

---

## Integration with Git Workflow

### Pre-commit Hook (Optional)

Some projects add a pre-commit hook to enforce checks:

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running yarn checks..."
yarn checks

if [ $? -ne 0 ]; then
    echo "❌ Checks failed. Commit aborted."
    echo "Fix errors and try again."
    exit 1
fi

echo "✅ Checks passed. Proceeding with commit."
```

### CI/CD Pipeline

Checks should also run in CI:

```yaml
# .github/workflows/ci.yml
- name: Run checks
  run: yarn checks
```

This catches issues even if local checks were skipped.

---

## Troubleshooting

### "yarn checks" is slow

**Cause:** Large codebase, many files to check

**Solutions:**
- Use `yarn watch-checks` during development (watches for changes)
- Run `yarn ts` and `yarn lint` separately to identify bottleneck
- Check if node_modules needs reinstall

### False positives from ESLint

**Cause:** Rule is too strict or misconfigured

**Solutions:**
- Update `.eslintrc.json` to adjust rule severity
- Add `eslint-disable-next-line` comment (sparingly)
- Discuss rule with team if it's consistently problematic

### TypeScript errors in node_modules

**Cause:** Dependency has type issues

**Solutions:**
- Update dependency to latest version
- Add `skipLibCheck: true` in `tsconfig.json` (already enabled)
- Report issue to dependency maintainer

---

## Best Practices

### During Development

1. **Run checks frequently:** After each significant change
2. **Fix immediately:** Don't accumulate errors
3. **Use watch mode:** `yarn watch-checks` for real-time feedback
4. **Read error messages:** They usually tell you exactly what's wrong

### In Planning Mode

1. **Always include validation task:** Make it explicit in the plan
2. **Estimate time:** Add buffer for fixing potential errors
3. **Run before exit:** Even if not in original plan, run before marking complete
4. **Document blockers:** If checks can't pass, explain why and get user input

### In Code Reviews

1. **Verify checks passed:** Don't approve PRs with failing checks
2. **Check CI status:** Green checks in GitHub/GitLab
3. **Local verification:** Pull branch and run `yarn checks` locally
4. **Enforce standards:** Require all PRs to pass checks

---

## Related Documentation

- [.eslintrc.json](../.eslintrc.json) - ESLint configuration
- [tsconfig.json](../tsconfig.json) - TypeScript configuration
- [package.json](../package.json) - Scripts definition
- [.ai/skills/typescript-guidelines/SKILL.md](../.ai/skills/typescript-guidelines/SKILL.md) - TypeScript rules

---

**See also:**
- CLAUDE.md - Concise summary of validation requirements
- [docs/app-guidelines-checklist-extended.md](docs/app-guidelines-checklist-extended.md) - Full compliance checklist
