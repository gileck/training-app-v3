/**
 * App URL accessors — the single way to read the app's production URL.
 *
 * The URL comes from ONE env var, `NEXT_PUBLIC_APP_URL` (see `appConfig.appUrl`).
 * In development it falls back to localhost; in production it is `undefined`
 * when unset, on purpose, so we never silently build links against a wrong
 * default domain.
 *
 * - `getAppUrl()` — best-effort: the URL (no trailing slash) or `null`. Use when
 *   a missing URL should degrade gracefully (e.g. omit a button in a notice).
 * - `requireAppUrl()` — the URL (no trailing slash), or throws a clear error.
 *   Use when building a user-facing link that MUST work.
 */

import { appConfig } from '@/app.config';

export const APP_URL_MISSING_MESSAGE =
    'NEXT_PUBLIC_APP_URL is not set. Set your production URL — run `yarn set-app-url <https://yourapp.com>`, or set it in .env.local and on Vercel.';

export function getAppUrl(): string | null {
    const url = appConfig.appUrl;
    return url ? url.replace(/\/$/, '') : null;
}

export function requireAppUrl(): string {
    const url = getAppUrl();
    if (!url) {
        throw new Error(APP_URL_MISSING_MESSAGE);
    }
    return url;
}
