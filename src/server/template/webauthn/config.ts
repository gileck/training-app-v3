/**
 * WebAuthn (passkey) relying-party configuration.
 *
 * A passkey is bound to a single **rpID** (a registrable domain). Two hard
 * rules follow from that:
 *   1. rpID must be a STABLE domain. Passkeys registered on the production
 *      domain do NOT work on Vercel *preview* URLs (different host) — those
 *      are a separate origin and the browser will refuse the credential.
 *   2. dev and prod legitimately differ: dev = `localhost`, prod = the real
 *      deployment domain.
 *
 * Resolution order for rpID:
 *   - `WEBAUTHN_RP_ID` env (the explicit, stable prod domain) — preferred.
 *   - else the host of `appConfig.appUrl`.
 *   - in development, always `localhost` (host-only, port stripped) so Touch
 *     ID works on `http://localhost:<port>`.
 *
 * `expectedOrigin` is the full scheme+host(+port) the ceremony must have come
 * from. We accept an array so a deployment can serve from its rpID domain and
 * (in dev) from any localhost port.
 *
 * NOTE: nothing here is wired into the live auth flow during Phase 0 — it is
 * the foundation later passkey ceremonies (Phase 1+) consume. Passwords are
 * unaffected.
 */

import { appConfig } from '@/app.config';

export interface WebAuthnConfig {
    /** Registrable domain the credential is bound to (no scheme, no port). */
    rpID: string;
    /** Human-readable name shown in the OS passkey prompt. */
    rpName: string;
    /** Allowed origin(s) the ceremony may originate from. */
    expectedOrigin: string | string[];
}

function isDev(): boolean {
    return process.env.NODE_ENV !== 'production';
}

/** Strip scheme/port/path from a URL down to its bare host. */
function hostOf(url: string | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

export function getRpID(): string {
    if (isDev()) return 'localhost';
    return process.env.WEBAUTHN_RP_ID || hostOf(appConfig.appUrl) || 'localhost';
}

export function getWebAuthnConfig(): WebAuthnConfig {
    const rpID = getRpID();
    const rpName = appConfig.appName;

    if (isDev()) {
        // SimpleWebAuthn matches the browser's exact origin against this list.
        // Next dev hops to 3001/3002/... when 3000 is busy, so accept a range
        // of localhost ports (both localhost and 127.0.0.1). An explicit
        // WEBAUTHN_ORIGIN overrides if you run dev on something exotic.
        const explicit = process.env.WEBAUTHN_ORIGIN;
        const expectedOrigin = explicit
            ? [explicit]
            : Array.from({ length: 21 }, (_, i) => 3000 + i).flatMap((port) => [
                  `http://localhost:${port}`,
                  `http://127.0.0.1:${port}`,
              ]);
        return { rpID, rpName, expectedOrigin };
    }

    const explicitOrigin = process.env.WEBAUTHN_ORIGIN;
    const origin = explicitOrigin || appConfig.appUrl || `https://${rpID}`;
    return { rpID, rpName, expectedOrigin: origin };
}
