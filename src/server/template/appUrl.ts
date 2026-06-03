/**
 * App URL accessors — the single, TEMPLATE-OWNED (synced) way to resolve the
 * app's URL.
 *
 * The resolution lives HERE, not in `src/app.config.js`: app.config.js is
 * project-owned and NOT synced by template-sync, so logic placed there never
 * reaches child projects. This file is under `src/server/template/**` (synced),
 * so the resolution + the fix propagate to every child.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL            — explicit override (custom domain / pin).
 *   2. VERCEL_PROJECT_PRODUCTION_URL  — auto-provided by Vercel, per-PROJECT
 *      correct (its own stable production domain). Zero-config default on Vercel
 *      (production AND preview).
 *   3. dev → http://localhost:3000.
 *   4. otherwise null → requireAppUrl() throws (only off Vercel, unconfigured).
 * There is intentionally NO hardcoded fallback domain — that was the bug
 * (projects silently inheriting app-template-ai.vercel.app).
 *
 * - `getAppUrl()` — best-effort: the URL (no trailing slash) or `null`.
 * - `requireAppUrl()` — the URL, or throws a clear error. Use for links that
 *   MUST work.
 */

export const APP_URL_MISSING_MESSAGE =
    'App URL is not configured. On Vercel this comes from VERCEL_PROJECT_PRODUCTION_URL automatically; otherwise set NEXT_PUBLIC_APP_URL (e.g. `yarn set-app-url <https://yourapp.com>`).';

function resolveAppUrl(): string | null {
    const override = process.env.NEXT_PUBLIC_APP_URL;
    if (override) return override.replace(/\/+$/, '');

    const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (vercelProd) return `https://${vercelProd}`.replace(/\/+$/, '');

    if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';

    return null;
}

export function getAppUrl(): string | null {
    return resolveAppUrl();
}

export function requireAppUrl(): string {
    const url = resolveAppUrl();
    if (!url) {
        throw new Error(APP_URL_MISSING_MESSAGE);
    }
    return url;
}
