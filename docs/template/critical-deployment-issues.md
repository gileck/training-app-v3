---
title: Critical Deployment Issues
description: Common deployment pitfalls. Use this before deploying to production.
summary: Always run `vercel link` first. Verify env vars match with `yarn verify-production`. Use `src/pages/` not `pages/`.
priority: 4
---

# Critical Deployment Issues & Best Practices

Common pitfalls and solutions when deploying to production.

> **Note:** This is the detailed reference. See CLAUDE.md for a concise summary.

---

## ⚠️ CRITICAL: `pages/` vs `src/pages/` Directory Structure

### The Problem

Next.js prioritizes `pages/` over `src/pages/`. If you accidentally create `pages/` directory when the project uses `src/pages/`, Next.js will ignore `src/pages/` entirely, causing **all routes to return 404**.

### Symptoms

- Home page returns 404 in production
- Build output only shows routes from `pages/` directory
- Example build output showing the problem:
  ```
  Route (pages)                                Size  First Load JS
  ┌ ○ /404                                    190 B         102 kB
  └ ƒ /api/test-endpoint                        0 B         102 kB
  ```
  Notice: NO home page (`/`) route!

### This Project Uses

**`src/pages/` (NOT `pages/`)**

### Rules

- ✅ **ALWAYS** place new pages/API routes in `src/pages/`
- ❌ **NEVER** create `pages/` directory at project root
- ❌ **NEVER** add files to `pages/` if it exists (delete it instead)

### Correct Structure

```
src/
  pages/
    index.tsx          ✅ Home page
    [...slug].tsx      ✅ Catch-all route
    _app.tsx           ✅ App wrapper
    _document.tsx      ✅ Document wrapper
    api/
      process/         ✅ API routes
      telegram-webhook.ts  ✅ API endpoints
```

### Incorrect Structure (Breaks Everything)

```
pages/                 ❌ WRONG! Delete this directory
  api/
    new-endpoint.ts    ❌ This will break all routes in src/pages/

src/
  pages/               ⚠️  Will be ignored if pages/ exists
    index.tsx          ⚠️  Won't be built
    [...slug].tsx      ⚠️  Won't be built
```

### How to Fix

If you accidentally created `pages/`:

```bash
# Move any new files to correct location
mv pages/api/new-endpoint.ts src/pages/api/new-endpoint.ts

# Remove the incorrect directory
rmdir pages/api
rmdir pages

# Verify structure is correct
ls -la src/pages/
```

### Prevention

Before adding new pages/API routes, always check project structure:

```bash
# This project uses src/pages/ - add files here
ls -la src/pages/

# This directory should NOT exist
ls -la pages/  # Should show "No such file or directory"
```

### Why This Happens

Next.js has two supported structures:
1. `pages/` at root
2. `src/pages/` (organized structure)

If both exist, Next.js uses `pages/` and ignores `src/pages/`. This is intentional behavior but can catch developers off guard.

### Detection in Build

Watch for these signs in build output:

**Bad (missing routes):**
```
Route (pages)                                Size  First Load JS
┌ ○ /404                                    190 B         102 kB
└ ƒ /api/test-endpoint                        0 B         102 kB
```

**Good (all routes present):**
```
Route (pages)                                Size  First Load JS
┌ ○ /                                       250 B         112 kB
├ ○ /404                                    190 B         102 kB
├ ○ /settings                               310 B         115 kB
└ ƒ /api/process/[api_name]                   0 B         102 kB
```

---

## The app URL — auto on Vercel, override with `NEXT_PUBLIC_APP_URL`

Every absolute link the app builds — passkey enrollment links, password-reset
and login-approval links, Telegram deep-links, the WebAuthn origin — comes from
`appConfig.appUrl`, read through the `getAppUrl()` / `requireAppUrl()` helpers
(`src/server/template/appUrl.ts`).

### Resolution order (zero-config on Vercel)

1. **`NEXT_PUBLIC_APP_URL`** — explicit override (custom domain / testing).
2. **`VERCEL_PROJECT_PRODUCTION_URL`** — auto-provided by Vercel, **per-project
   correct** (each project's own stable production domain, including custom
   domains). This is the default, so deployed projects "just work" with no env
   setup, on production **and** preview.
3. **Development:** `http://localhost:3000`.
4. Otherwise **`undefined`** → link builders call `requireAppUrl()`, which
   **throws a clear error** rather than producing a wrong link. In practice this
   only happens off Vercel with nothing configured; best-effort callers use
   `getAppUrl()` and degrade gracefully.

There is intentionally **NO hardcoded fallback domain** — that was the bug:
projects silently inherited `app-template-ai.vercel.app`. The per-project
`VERCEL_PROJECT_PRODUCTION_URL` gives the *correct* domain instead.

### When to set `NEXT_PUBLIC_APP_URL`

Only to **override** the auto value — e.g. a custom domain Vercel doesn't report,
or to pin it explicitly:

```bash
yarn set-app-url https://yourapp.com   # sets it on Vercel for ALL environments
```

Use a **stable** domain (not a per-deployment preview URL `*-xyz123.vercel.app`,
which changes every deploy and would break links + WebAuthn). `--local` also
writes `.env.local`; otherwise local dev uses `http://localhost:3000`.

> Existing projects need **no migration** — they pick up their own
> `VERCEL_PROJECT_PRODUCTION_URL` automatically after syncing.

### References

- [Vercel System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Next.js URL Discussion](https://github.com/vercel/next.js/discussions/16429)

---


## Additional Best Practices

### 1. Always Test Build Locally

Before deploying:
```bash
yarn build
```

Check build output for:
- All expected routes present
- No unexpected errors
- Reasonable bundle sizes

### 2. Check Environment Variables

Before deploying, verify all required env vars are set:

**Local:**
```bash
cat .env.local
```

**Vercel:**
```bash
yarn vercel-cli env --target production
```

### 3. Monitor First Deployment

After deploying major changes:
1. Check Vercel deployment logs
2. Visit the deployed URL
3. Test critical user flows
4. Check error tracking (if configured)

### 4. Use Preview Deployments

For PRs:
1. Vercel creates preview deployment automatically
2. Test on preview before merging
3. Preview has separate environment (good for testing)

### 5. Keep Dependencies Updated

Regularly update dependencies:
```bash
yarn upgrade-interactive
```

Test after updates:
```bash
yarn checks
yarn build
```

---

## Quick Reference Checklist

Before deploying:

- [ ] Code in `src/pages/` not `pages/`
- [ ] `yarn checks` passes
- [ ] `yarn build` succeeds
- [ ] All routes present in build output
- [ ] Environment variables configured in Vercel
- [ ] Tested locally with production build (`yarn build && yarn start`)
- [ ] No console errors in browser
- [ ] Critical user flows work

---

**See also:**
- CLAUDE.md - Concise deployment issues summary
- [docs/project-validation.md](project-validation.md) - Project validation guide
