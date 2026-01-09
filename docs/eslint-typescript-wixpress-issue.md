# ESLint TypeScript Issue with Wixpress Registry

## Problem Summary

ESLint fails with the error `tsutils.iterateComments is not a function` when linting TypeScript files. This prevents `yarn lint` and `yarn checks` from passing.

## Root Cause

The **wixpress npm registry** (`https://npm.dev.wixpress.com/`) contains a broken version of `@typescript-eslint` packages (version `8.52.0`) that:

1. **Uses deprecated `tsutils` package** - The `tsutils` package was deprecated and replaced with `ts-api-utils`. The old `tsutils` doesn't work with TypeScript 5.x.

2. **Version doesn't exist on public npm** - Version `8.52.0` of `@typescript-eslint/*` packages doesn't exist on the public npm registry (https://registry.npmjs.org/). The latest public version is around `8.28.x`.

3. **Forced by user's global `.npmrc`** - The user's `~/.npmrc` is configured to use the wixpress registry:
   ```
   registry=https://npm.dev.wixpress.com/
   ```

## Error Message

```
./src/apis/apis.ts
Error: Parsing error: tsutils.iterateComments is not a function

./src/apis/auth/client.ts
Error: Parsing error: tsutils.iterateComments is not a function
... (all .ts and .tsx files)
```

## Solution (Currently Implemented)

### Manual Package Copy

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

### ESLint Configuration

With the correct packages, `eslint.config.mjs` uses the standard Next.js TypeScript configuration:

```javascript
const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // ... rules including @typescript-eslint/no-unused-vars
  }
];
```

### Validation

```bash
# All checks pass with full TypeScript ESLint support
yarn checks
```

## Yarn Lock Management

### The Problem

When running `yarn install` locally with the wixpress registry, `yarn.lock` gets populated with wixpress URLs and the broken 8.52.0 versions will be reinstalled, overwriting the working packages.

### The Solution

1. **Before every commit**, checkout `yarn.lock` to keep the clean version:
   ```bash
   git checkout yarn.lock
   git add <other-files>
   git commit -m "your message"
   git push
   ```

2. **After running `yarn install`** (which reinstalls broken packages), re-copy the working packages from another project.

### Why Not .gitignore?

Adding `yarn.lock` to `.gitignore` was considered but rejected because:
- Less reproducible builds
- Different developers might get different package versions
- Not a best practice for production projects

## What Was Tried (Failed Attempts)

### 1. Removing `next/typescript` from ESLint Config
**Result:** Failed. The `next/core-web-vitals` config still loads the TypeScript parser.

### 2. Overriding the Parser for TypeScript Files
**Result:** Failed. The Next.js ESLint config overrides this setting.

### 3. Using Yarn Resolutions
**Result:** Failed. Yarn still resolves to `8.52.0` from wixpress.

### 4. Clearing Yarn Cache and Reinstalling
**Result:** Failed. Fresh install still pulls `8.52.0` from wixpress.

### 5. Downgrading TypeScript to 4.9.5
**Result:** Failed. The `tsutils` error persists regardless of TypeScript version.

### 6. Project-Level .npmrc Override
**Result:** Not possible. User cannot access the public npm registry from their network.

## The Real Solution

The **real solution** would be one of the following:

### Option A: Fix the Wixpress Registry
Contact wixpress registry administrators to:
1. Update `@typescript-eslint` packages to versions that use `ts-api-utils` instead of `tsutils`
2. Or mirror the correct versions from public npm

### Option B: Access Public npm Registry
Configure network access to allow reaching `https://registry.npmjs.org/` for specific packages.

## Environment Differences

| Environment | Registry | @typescript-eslint | ESLint TS Support |
|-------------|----------|-------------------|-------------------|
| Local (after fix) | wixpress + manual copy | 8.28.0 (copied) | Full support |
| Local (after yarn install) | wixpress | 8.52.0 (broken) | Needs re-copy |
| Vercel | registry.npmjs.org | 8.x (working) | Full support |

## Related Files

- `eslint.config.mjs` - ESLint configuration with full TypeScript support
- `package.json` - TypeScript ^5.0.0
- `tsconfig.json` - TypeScript configuration with `moduleResolution: "bundler"`
- `yarn.lock` - Must be checked out before commits to avoid wixpress URLs

## Quick Reference

### After `yarn install` (packages broken)
```bash
# Re-copy working packages from another project
cp -r /path/to/working-project/node_modules/@typescript-eslint ./node_modules/
cp -r /path/to/working-project/node_modules/ts-api-utils ./node_modules/
cp -r /path/to/working-project/node_modules/graphemer ./node_modules/
```

### Before committing
```bash
git checkout yarn.lock
```
