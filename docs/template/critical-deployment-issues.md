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

## ✅ Vercel Environment Variables - Automatic URLs

### Good News

Vercel automatically provides stable production URLs - **no manual configuration needed!**

### Automatic System Variables

| Variable | Description | Stability | Example | Protocol |
|----------|-------------|-----------|---------|----------|
| `VERCEL_PROJECT_PRODUCTION_URL` | **Stable production domain** | ✅ Never changes | `app-template-ai.vercel.app` | No `https://` |
| `VERCEL_URL` | Current deployment URL | ❌ Changes per deployment | `app-template-xyz123.vercel.app` | No `https://` |
| `VERCEL_BRANCH_URL` | Git branch URL | ⚠️  Stable per branch | `app-template-git-main.vercel.app` | No `https://` |
| `VERCEL_ENV` | Environment | ✅ Never changes | `production`, `preview`, `development` | N/A |

### Important Note

**Vercel URLs don't include the protocol** - always prepend `https://`

### Usage in Code

```typescript
function getBaseUrl(): string {
    // 1. Stable production domain (automatic) ✅ BEST
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    // 2. Deployment-specific URL (automatic)
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    // 3. Manual override (optional)
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    // 4. Local development
    return 'http://localhost:3000';
}
```

### When to Manually Set NEXT_PUBLIC_APP_URL

- ✅ Using a custom domain (e.g., `myapp.com` instead of `*.vercel.app`)
- ✅ Want to override for testing purposes
- ❌ NOT needed for standard `*.vercel.app` domains (automatic)

### Why VERCEL_PROJECT_PRODUCTION_URL is Better

**Problem with VERCEL_URL:**
- Changes with each deployment (`app-template-xyz123.vercel.app`)
- Old URLs become invalid after new deployment
- Breaks bookmarked links
- Telegram buttons stop working

**Solution with VERCEL_PROJECT_PRODUCTION_URL:**
- Stable across all deployments (`app-template-ai.vercel.app`)
- Always redirects to latest deployment
- Links never break
- Telegram approval buttons work permanently

### Real-World Impact

**Telegram Approval Buttons:**
When agents send Telegram notifications with approval buttons, the button URLs must remain valid. Using `VERCEL_URL` means:
1. Agent creates feature, sends Telegram notification
2. URLs in buttons point to `app-template-xyz123.vercel.app`
3. New code is pushed, new deployment created
4. URLs now point to old deployment
5. Buttons may not work or show stale data

Using `VERCEL_PROJECT_PRODUCTION_URL` ensures buttons always work.

### References

- [Vercel System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Next.js URL Discussion](https://github.com/vercel/next.js/discussions/16429)

---

## ⚠️ CRITICAL: Markdown Extraction with Nested Code Blocks

### The Problem

Agent-generated design documents that include code examples (with nested ``` code blocks) were being **truncated mid-sentence**, losing all content after the first code example.

### Symptoms

- Design content cuts off after text like: "Place the form between the header and filters section:"
- Everything after the first code block is missing
- GitHub issue body is incomplete
- Example: [Issue #15](https://github.com/gileck/app-template-ai/issues/15)

### Root Cause

`extractMarkdown()` function in `src/agents/shared/claude.ts` used a **non-greedy regex** that stopped at the FIRST ``` closing fence, even if it was inside a nested code block.

### Example of the Bug

Agent returns:
````markdown
```markdown
# UI Placement

Place the form between the header and filters section:

```jsx          <-- OLD REGEX STOPPED HERE!
<Header />
<NewFeatureRequestForm />
<Filters />
```

This ensures proper placement.

## Component Structure

The form has these fields...
```
````

### The Buggy Code

```javascript
// ❌ BAD: Non-greedy regex
const regex = /```markdown\s*([\s\S]*?)\s*```/;
```

**Why it failed:**
- The `([\s\S]*?)` is non-greedy (stops at first match)
- Matched everything up to the first ``` (inside the JSX block)
- Lost all content after the first nested code block

### The Fix

Proper fence marker parsing that:
1. Finds opening ```` ```markdown ````
2. Counts depth of nested code blocks
3. Distinguishes opening fences (with language) from closing fences
4. Only closes when depth returns to 0
5. Handles edge case of missing closing fence

**File:** `src/agents/shared/claude.ts:253-317`

### How the Fix Works

```javascript
function extractMarkdown(content: string): string {
    // Find opening ```markdown
    const openingIndex = content.indexOf('```markdown');
    if (openingIndex === -1) return content;

    // Start after opening fence
    let pos = openingIndex + '```markdown'.length;
    let depth = 0;

    while (pos < content.length) {
        const fenceMatch = content.slice(pos).match(/^```(\w*)/m);

        if (!fenceMatch) {
            // No closing fence found, return rest of content
            return content.slice(openingIndex + '```markdown\n'.length);
        }

        if (fenceMatch[1]) {
            // Opening fence (has language specifier)
            depth++;
        } else {
            // Closing fence (no language)
            if (depth === 0) {
                // Found matching closing fence
                return content.slice(
                    openingIndex + '```markdown\n'.length,
                    pos + fenceMatch.index
                ).trim();
            }
            depth--;
        }

        pos += fenceMatch.index + fenceMatch[0].length;
    }

    // Fallback: return from opening to end
    return content.slice(openingIndex + '```markdown\n'.length);
}
```

### Testing

```javascript
// Test case with nested code blocks
const input = `
\`\`\`markdown
# Title

Example code:

\`\`\`jsx
<Component />
\`\`\`

More content here.
\`\`\`
`;

// Before fix: extracted "# Title\n\nExample code:\n\n" (70 chars)
// After fix: extracted complete content (348 chars)

const extracted = extractMarkdown(input);
console.log(extracted.length); // 348 (complete)
```

### Prevention

The fix handles:
- ✅ Arbitrary nesting depth
- ✅ Any code block language (jsx, typescript, bash, etc.)
- ✅ Opening vs closing fence distinction
- ✅ Missing closing fence edge case
- ✅ Multiple nested code blocks

### If You Encounter This Again

1. Check if the design includes code examples
2. Verify the full design was extracted by inspecting the GitHub issue body
3. Look for truncation after colons followed by code blocks
4. The fix is in `extractMarkdown()` at `src/agents/shared/claude.ts:253-317`

### Related Issues

This pattern can affect:
- Any regex-based markdown parsing
- Code fence extraction in other contexts
- Documentation generation
- Template processing

**General Rule:** When parsing nested structures, use depth tracking instead of greedy/non-greedy regex.

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
- [docs/github-projects-integration-extended.md](github-projects-integration-extended.md) - Production setup for agents
