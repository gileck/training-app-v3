#!/usr/bin/env tsx
/**
 * Set `NEXT_PUBLIC_APP_URL` — the OVERRIDE for the app's URL.
 *
 * On Vercel, `appConfig.appUrl` already defaults to the project's own
 * `VERCEL_PROJECT_PRODUCTION_URL` (correct, zero-config), so you usually don't
 * need this. Use it to override that — e.g. a custom domain Vercel doesn't
 * report, or to pin the URL explicitly. Everything that builds an absolute link
 * (passkey enrollment, password reset / login-approval, Telegram deep-links,
 * WebAuthn origin) reads `appConfig.appUrl` via `getAppUrl()` / `requireAppUrl()`.
 *
 * The override belongs on Vercel (set for ALL environments — preview deploys
 * also run with NODE_ENV=production, so a production-only value would break
 * their links). `.env.local` is opt-in, since setting it locally makes dev
 * build links against that URL instead of the localhost fallback.
 *
 * Usage:
 *   yarn set-app-url https://myapp.com            # set on Vercel (all envs)  [default]
 *   yarn set-app-url myapp.com                    # https:// is added for you
 *   yarn set-app-url https://myapp.com --local    # write .env.local instead
 *   yarn set-app-url https://myapp.com --local --vercel   # both
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

const ENV_VAR = 'NEXT_PUBLIC_APP_URL';

function normalizeUrl(input: string): string {
    let url = input.trim();
    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }
    url = url.replace(/\/+$/, '');
    // Validate + reduce to scheme + host (drop any path/query the user pasted).
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        console.error(`Invalid URL: "${input}"`);
        process.exit(1);
    }
    if (!parsed.hostname) {
        console.error(`Invalid URL (no host): "${input}"`);
        process.exit(1);
    }
    return `${parsed.protocol}//${parsed.host}`;
}

/** Upsert KEY=value in .env.local. */
function writeEnvLocal(key: string, value: string): void {
    const envPath = path.resolve(process.cwd(), '.env.local');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) {
        content = content.replace(re, line);
    } else {
        content += (content && !content.endsWith('\n') ? '\n' : '') + `${line}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    console.log(`Wrote ${key}=${value} to .env.local`);
}

function main(): void {
    const args = process.argv.slice(2);
    const writeLocal = args.includes('--local');
    // The prod URL targets Vercel by default; --local writes .env.local instead
    // (use --local --vercel for both).
    const pushVercel = args.includes('--vercel') || args.includes('--prod') || !writeLocal;
    const urlArg = args.find((a) => !a.startsWith('--'));

    if (!urlArg) {
        console.error('Usage: yarn set-app-url <url> [--local] [--vercel]');
        process.exit(1);
    }

    const url = normalizeUrl(urlArg);

    if (writeLocal) {
        writeEnvLocal(ENV_VAR, url);
    }

    if (pushVercel) {
        // Set for ALL environments. Vercel preview deployments also run with
        // NODE_ENV=production, so a production-only value would leave previews
        // with appUrl=undefined and every link builder would throw.
        console.log('Setting on Vercel (all environments)…');
        execSync(
            `yarn vercel-cli env:set --name ${ENV_VAR} --value ${url} --target production,preview,development`,
            { stdio: 'inherit', cwd: process.cwd() }
        );
        console.log('\nDone. Redeploy for it to take effect.');
    }

    if (!writeLocal) {
        console.log(
            `\nNote: not written to .env.local (local dev falls back to ` +
                `http://localhost:3000). Pass --local if you want dev to use ${url}.`
        );
    }
}

main();
