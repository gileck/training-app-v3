---
title: Project Validation
description: Complete guide to code validation - what checks exist, how they run locally and in CI, and how to use them programmatically.
summary: "**CRITICAL: Always run `yarn checks` before completing work.** Runs 4 checks in parallel: TypeScript, ESLint, circular dependencies, unused dependencies. Must pass with 0 errors before committing, creating PRs, or deploying."
priority: 1
---

# Project Validation

Complete guide to code quality validation - what checks exist, how they run locally and in CI, and how to handle results programmatically.

---

## Overview

The project uses four validation checks to ensure code quality:

| Check | Command | What It Catches |
|-------|---------|-----------------|
| TypeScript | `yarn ts` | Type errors, missing properties, type mismatches |
| ESLint | `yarn lint` | Code quality, patterns, unused variables, custom rules |
| Circular Dependencies | `yarn check:circular` | Import cycles that cause runtime issues |
| Unused Dependencies | `yarn check:unused:ci` | Unresolved imports, missing packages |

**Critical Rule:** Always run `yarn checks` before committing, creating PRs, or deploying.

---

## Running Locally

### Quick Command

```bash
yarn checks
```

This runs all 4 checks **in parallel** with colored output:

```
🔍 Running all checks in parallel...

✓ TypeScript
  $ tsc --noEmit

✓ ESLint
  $ next lint
  ✔ No ESLint warnings or errors

✓ Circular Dependencies
  $ madge --circular --extensions ts,tsx --ts-config tsconfig.json src/
  Processed 474 files (2.5s)

✓ Unused Dependencies
  $ knip --include unresolved --no-config-hints

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All checks passed!
```

### Individual Checks

Run specific checks when debugging:

```bash
yarn ts              # TypeScript only
yarn lint            # ESLint only
yarn check:circular  # Circular dependencies only
yarn check:unused    # Unused dependencies only
```

### Watch Mode

For continuous feedback during development:

```bash
yarn watch-checks    # Watches for changes and re-runs checks
```

---

## Automated Validation

### Pre-commit Hook

The pre-commit hook automatically runs `yarn checks` before every commit:

```
[pre-commit] Running yarn checks...
✓ TypeScript
✓ ESLint
✓ Circular Dependencies
✓ Unused Dependencies
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All checks passed!
```

If any check fails, the commit is blocked:

```
[pre-commit] Running yarn checks...
✗ TypeScript
  src/pages/index.tsx(1,7): error TS2322: Type 'string' is not assignable to type 'number'.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Checks failed:
   • TypeScript

❌ ERROR: yarn checks failed

Fix the issues above before committing.
Run 'yarn checks' to see all errors.
```

**Setup:** Run `yarn setup-hooks` to install the pre-commit hook.

### Template Sync Validation

When syncing from template, `yarn checks` runs automatically to verify the sync didn't break anything.

---

## CI Pipeline

### GitHub Actions (PR Checks)

Pull requests trigger 4 parallel jobs in GitHub Actions:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ TypeScript  │  │   ESLint    │  │  Circular   │  │   Unused    │
│   (yarn ts) │  │ (yarn lint) │  │   Deps      │  │    Deps     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
       └────────────────┴────────────────┴────────────────┘
                                │
                         ┌──────▼──────┐
                         │   Summary   │
                         │ (PR comment │
                         │ + Telegram) │
                         └─────────────┘
```

**Benefits of parallel jobs:**
- Faster execution (all checks run simultaneously)
- Clear visibility (see exactly which check failed)
- Can re-run individual failed checks
- Independent caching per check

**On failure:**
- PR comment with status table showing which checks failed
- Telegram notification with links to PR and logs

### Workflow File

See `.github/workflows/pr-checks.yml` for the full configuration.

---

## Programmatic Usage (Exit Codes)

When using validation in scripts or agents, **always use exit codes** - never parse output.

### Critical Principle

```
Exit code 0     = Success (all checks passed)
Exit code != 0  = Failure (one or more checks failed)
```

### TypeScript Example

```typescript
import { execSync } from 'child_process';

function runYarnChecks(): { success: boolean; output: string } {
    try {
        const output = execSync('yarn checks', {
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 120000,
        });
        // If execSync didn't throw, exit code was 0 = success
        return { success: true, output };
    } catch (error) {
        // execSync throws when exit code is non-zero = failure
        const err = error as { stdout?: string; stderr?: string };
        const output = err.stdout || err.stderr || String(error);
        return { success: false, output };
    }
}
```

### Why Not Parse Output?

❌ **WRONG - Output Parsing (UNRELIABLE):**
```typescript
const output = execSync('yarn checks');
const success = output.includes('✅ All checks passed!'); // FRAGILE!
```

**Problems with output parsing:**
- Output format can change
- Emoji rendering issues
- Timing issues with stdout/stderr interleaving
- Truncation in large outputs

✅ **CORRECT - Exit Code (RELIABLE):**
```typescript
try {
    execSync('yarn checks', { stdio: 'pipe' });
    // Success - exit code was 0
} catch (error) {
    // Failure - exit code was non-zero
}
```

### Bash Example

```bash
#!/bin/bash
set +e  # Don't exit on first error

yarn checks
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "All checks passed"
else
    echo "Checks failed with exit code: $EXIT_CODE"
    exit 1
fi
```

---

## Error Resolution

When `yarn checks` fails, follow this order:

### 1. Fix TypeScript Errors First

Type safety is the foundation. Other errors may be false positives if types are wrong.

```bash
yarn ts
```

**Common TypeScript Errors:**

| Error | Fix |
|-------|-----|
| `Type 'X' is not assignable to type 'Y'` | Update types or add proper assertions |
| `Property 'foo' is missing` | Add the property or make it optional |
| `Cannot access 'X' before initialization` | Reorganize imports to break circular dependency |

### 2. Fix ESLint Errors Second

Code quality issues are easier to fix when types are correct.

```bash
yarn lint
```

**Common ESLint Errors:**

| Error | Fix |
|-------|-----|
| `'foo' is defined but never used` | Remove the variable or use it |
| `React Hook useEffect has a missing dependency` | Add to dependency array |
| Direct zustand imports | Use `createStore` from `@/client/stores` |

### 3. Fix Circular Dependencies

```bash
yarn check:circular
```

If circular dependencies are found, reorganize imports to break the cycle. Common solutions:
- Move shared types to a separate file
- Use dynamic imports
- Restructure module boundaries

### 4. Fix Unused Dependencies

```bash
yarn check:unused
```

If unresolved imports are found:
- Install missing packages: `yarn add <package>`
- Fix typos in import paths
- Remove unused imports

### 5. Re-run Until Clean

```bash
yarn checks
```

Keep fixing and re-running until all checks pass.

---

## When to Run Checks

| Action | Why Checks Matter |
|--------|-------------------|
| Before committing | Prevents broken commits (pre-commit hook enforces this) |
| Before creating PRs | Ensures PR passes CI checks |
| Before syncing to child projects | Prevents propagating breaks |
| Before deploying | Catches issues before users see them |
| After merging branches | Validates integration success |

---

## Troubleshooting

### "yarn checks" is slow

**Solutions:**
- Checks run in parallel by default (~4s total)
- For single checks during debugging, use `yarn ts` or `yarn lint` directly
- Use `yarn watch-checks` during active development

### False positives from ESLint

**Solutions:**
- Update rule configuration in `config/eslint/eslint.project.mjs`
- Add `eslint-disable-next-line` comment (sparingly, with explanation)
- See [ESLint Custom Rules](./eslint-custom-guidelines.md) for guidance

### TypeScript errors in node_modules

**Solutions:**
- Update dependency to latest version
- `skipLibCheck: true` is already enabled in tsconfig
- Report issue to dependency maintainer

### Pre-commit hook not running

**Solution:**
```bash
yarn setup-hooks
```

This installs the pre-commit hook in `.git/hooks/`.

---

## Implementation Details

### Script Location

The validation script is at `scripts/template/checks.sh`.

### How Parallel Execution Works

The script uses bash background processes to run all checks simultaneously:

```bash
# Run all checks in parallel
(yarn ts 2>&1 > ts.out; echo $? > ts.exit) &
(yarn lint 2>&1 > lint.out; echo $? > lint.exit) &
(yarn check:circular 2>&1 > circular.out; echo $? > circular.exit) &
(yarn check:unused:ci 2>&1 > unused.out; echo $? > unused.exit) &

# Wait for all to complete
wait

# Check exit codes and report results
```

### Exit Code Handling

The script properly aggregates exit codes:
- If ALL checks pass (exit code 0), script exits with 0
- If ANY check fails (exit code != 0), script exits with 1

This ensures programmatic usage works correctly.

---

## Related Files

| File | Purpose |
|------|---------|
| `scripts/template/checks.sh` | Main validation script |
| `scripts/template/hooks/pre-commit` | Pre-commit hook |
| `.github/workflows/pr-checks.yml` | CI workflow |
| `config/eslint/eslint.template.mjs` | ESLint configuration |
| `tsconfig.json` | TypeScript configuration |
| `knip.json` | Unused dependency detection config |
