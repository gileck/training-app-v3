# Wixpress Registry Issues (Lock Files & ESLint)

> **Comprehensive documentation** for managing npm package issues in the Wix corporate network environment.
>
> See also: [CLAUDE.md](../CLAUDE.md) for the quick reference summary.

---

## Overview

This project requires special handling due to corporate network constraints. The **wixpress npm registry** (`npm.dev.wixpress.com`) causes two related issues:

1. **Lock File Management** - Local yarn.lock contains private registry URLs that shouldn't be committed
2. **ESLint/TypeScript Failure** - Broken `@typescript-eslint` packages from the wixpress registry

Both issues stem from the same root cause: the wixpress registry provides different (sometimes broken) package versions than public npm.

---

## Issue 1: Lock File Management

### Problem

Local development requires private npm registry (`npm.dev.wixpress.com`) because access to public npm is blocked. However, Vercel deployments need public registry URLs.

### Solution - Skip-Worktree Flag

After running `yarn setup-hooks`, git ignores local changes to `yarn.lock` using the `--skip-worktree` flag. This means:
- The committed `yarn.lock` (with public npm URLs) stays in the repo for Vercel
- Local changes (with wixpress URLs) don't show in `git status`
- You never accidentally commit wixpress registry URLs

### Setup (Run Once After Cloning)

```bash
yarn setup-hooks  # Sets up git hooks AND marks yarn.lock as skip-worktree
```

This runs `git update-index --skip-worktree yarn.lock` which tells git to ignore local modifications.

### Why skip-worktree Instead of .gitignore?

- `.gitignore` only works for untracked files - yarn.lock is already tracked
- We NEED yarn.lock in the repo with public URLs for Vercel deployments
- `--skip-worktree` keeps the committed version while hiding local changes

### Multi-Layer Protection

| Layer | yarn.lock | package-lock.json |
|-------|-----------|-------------------|
| **Committed version** | Public npm registry (for Vercel) | Should not exist (project uses yarn) |
| **Local changes** | Ignored via skip-worktree | Auto-removed by pre-commit hook |
| **GitHub Action** | Blocks PRs with `npm.dev.wixpress.com` | Blocks PRs containing this file |

### Use yarn, not npm

**IMPORTANT:** This project uses Yarn. If you accidentally run `npm install`, it will create `package-lock.json` with private registry URLs. The pre-commit hook will automatically remove it, but always use:

```bash
yarn install  # Correct
npm install   # Wrong - creates package-lock.json
```

### Pre-commit Hook Behavior

The hook in `.githooks/pre-commit` automatically:
1. Resets `yarn.lock` to HEAD (removes private registry URLs) - backup protection
2. Removes `package-lock.json` if it exists (project uses yarn)

### GitHub Action Protection

The workflow `.github/workflows/validate-yarn-lock.yml` runs on all PRs that modify lock files:
1. Fails if `package-lock.json` exists
2. Fails if `yarn.lock` contains `npm.dev.wixpress.com`

### When Dependencies Need Updating (Rare)

First, temporarily unset skip-worktree:
```bash
git update-index --no-skip-worktree yarn.lock
```

Then choose one option:
- **Option 1:** Let CI/Vercel regenerate yarn.lock automatically
- **Option 2:** Use a machine with public npm access to generate clean yarn.lock
- **Option 3:** Manually clean private registry URLs before committing

After committing, re-run `yarn setup-hooks` to restore skip-worktree.

### Checking Skip-Worktree Status

```bash
git ls-files -v | grep ^S  # Files with 'S' prefix have skip-worktree set
```

---

## Issue 2: ESLint TypeScript Failure

### Problem

ESLint fails with the error `tsutils.iterateComments is not a function` when linting TypeScript files. This prevents `yarn lint` and `yarn checks` from passing.

### Root Cause

The **wixpress npm registry** contains a broken version of `@typescript-eslint` packages (version `8.52.0`) that:

1. **Uses deprecated `tsutils` package** - The `tsutils` package was deprecated and replaced with `ts-api-utils`. The old `tsutils` doesn't work with TypeScript 5.x.

2. **Version doesn't exist on public npm** - Version `8.52.0` of `@typescript-eslint/*` packages doesn't exist on the public npm registry. The latest public version is around `8.28.x`.

3. **Forced by user's global `.npmrc`** - The user's `~/.npmrc` is configured to use the wixpress registry:
   ```
   registry=https://npm.dev.wixpress.com/
   ```

### Error Message

```
./src/apis/apis.ts
Error: Parsing error: tsutils.iterateComments is not a function

./src/apis/auth/client.ts
Error: Parsing error: tsutils.iterateComments is not a function
... (all .ts and .tsx files)
```

### Solution: Manual Package Copy

The fix involves copying working `@typescript-eslint` packages from another project that uses the public npm registry:

1. Find a project that has working `@typescript-eslint` packages (version 8.28.0 or similar from public npm)

2. Copy the following packages to `node_modules/`:
   ```bash
   # From a project with working packages:
   cp -r /path/to/working-project/node_modules/@typescript-eslint ./node_modules/
   cp -r /path/to/working-project/node_modules/ts-api-utils ./node_modules/
   cp -r /path/to/working-project/node_modules/graphemer ./node_modules/
   ```

3. The packages needed are:
   - `@typescript-eslint/parser` (8.28.0)
   - `@typescript-eslint/eslint-plugin` (8.28.0)
   - `@typescript-eslint/typescript-estree` (8.28.0)
   - `@typescript-eslint/utils` (8.28.0)
   - `@typescript-eslint/visitor-keys` (8.28.0)
   - `@typescript-eslint/scope-manager` (8.28.0)
   - `@typescript-eslint/types` (8.28.0)
   - `@typescript-eslint/type-utils` (8.28.0)
   - `ts-api-utils` (2.1.0)
   - `graphemer` (dependency of @typescript-eslint)

### After `yarn install` (Packages Broken)

Running `yarn install` will reinstall the broken packages from wixpress, overwriting the working packages. You need to re-copy:

```bash
# Re-copy working packages from another project
cp -r /path/to/working-project/node_modules/@typescript-eslint ./node_modules/
cp -r /path/to/working-project/node_modules/ts-api-utils ./node_modules/
cp -r /path/to/working-project/node_modules/graphemer ./node_modules/
```

### What Was Tried (Failed Attempts)

| Attempt | Result |
|---------|--------|
| Removing `next/typescript` from ESLint Config | Failed. `next/core-web-vitals` still loads the TypeScript parser. |
| Overriding the Parser for TypeScript Files | Failed. Next.js ESLint config overrides this setting. |
| Using Yarn Resolutions | Failed. Yarn still resolves to `8.52.0` from wixpress. |
| Clearing Yarn Cache and Reinstalling | Failed. Fresh install still pulls `8.52.0` from wixpress. |
| Downgrading TypeScript to 4.9.5 | Failed. The `tsutils` error persists regardless of TypeScript version. |
| Project-Level .npmrc Override | Not possible. User cannot access the public npm registry from their network. |

### The Real Solution

The **real solution** would be one of:

**Option A: Fix the Wixpress Registry**
Contact wixpress registry administrators to:
1. Update `@typescript-eslint` packages to versions that use `ts-api-utils` instead of `tsutils`
2. Or mirror the correct versions from public npm

**Option B: Access Public npm Registry**
Configure network access to allow reaching `https://registry.npmjs.org/` for specific packages.

---

## Environment Differences

| Environment | Registry | @typescript-eslint | ESLint TS Support |
|-------------|----------|-------------------|-------------------|
| Local (after fix) | wixpress + manual copy | 8.28.0 (copied) | Full support |
| Local (after yarn install) | wixpress | 8.52.0 (broken) | Needs re-copy |
| Vercel | registry.npmjs.org | 8.x (working) | Full support |

---

## Quick Reference

### Initial setup (run once after cloning)
```bash
yarn setup-hooks  # Sets skip-worktree on yarn.lock
```

### After `yarn install` (packages broken)
```bash
# Re-copy working packages from another project
cp -r /path/to/working-project/node_modules/@typescript-eslint ./node_modules/
cp -r /path/to/working-project/node_modules/ts-api-utils ./node_modules/
cp -r /path/to/working-project/node_modules/graphemer ./node_modules/
```

### Check skip-worktree status
```bash
git ls-files -v | grep ^S  # Files with 'S' prefix have skip-worktree set
```

### Temporarily unset skip-worktree (for dependency updates)
```bash
git update-index --no-skip-worktree yarn.lock
# ... make changes ...
yarn setup-hooks  # Re-set after updating
```

### Before committing
```bash
# Nothing needed! skip-worktree ensures yarn.lock changes are invisible to git
# Just commit your changes normally
```

---

## Related Files

- `eslint.config.mjs` - ESLint configuration with full TypeScript support
- `package.json` - TypeScript ^5.0.0
- `tsconfig.json` - TypeScript configuration with `moduleResolution: "bundler"`
- `yarn.lock` - Protected via skip-worktree (local changes ignored by git)
- `scripts/hooks/setup-hooks.sh` - Sets up skip-worktree for yarn.lock
- `.github/workflows/validate-yarn-lock.yml` - Validates lock files on PRs
- `.githooks/pre-commit` - Auto-removes package-lock.json and resets yarn.lock
