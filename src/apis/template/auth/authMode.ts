/**
 * Auth mode master switch.
 *
 * The template ships BOTH the password and the passkey (WebAuthn) auth
 * paths. Which one is live is decided by the `AUTH_MODE` env var — NOT by
 * any synced file. Env files are never touched by template sync, so a child
 * project that has merged the passkey code but hasn't run the
 * `/migrate-to-passkeys` skill yet will have `AUTH_MODE` unset and keep
 * running today's bcrypt password flow with zero behaviour change.
 *
 * Default = 'password'. A child opts in by setting `AUTH_MODE=passkey`
 * (locally in `.env.local` + on Vercel) as the final step of its migration.
 */

export type AuthMode = 'password' | 'passkey';

export const DEFAULT_AUTH_MODE: AuthMode = 'password';

/**
 * Resolve the active auth mode from the environment.
 * Anything other than the exact string 'passkey' falls back to the default
 * 'password' mode — unset, empty, or a typo all keep passwords working.
 */
export function getAuthMode(): AuthMode {
    return process.env.AUTH_MODE === 'passkey' ? 'passkey' : DEFAULT_AUTH_MODE;
}

export function isPasskeyMode(): boolean {
    return getAuthMode() === 'passkey';
}

/**
 * Shown when a password-credential endpoint is reached while the deployment is
 * in passkey mode (Phase 6 retirement). Guarded by the flag, so flipping
 * `AUTH_MODE=password` restores the password flow with no code change.
 */
export const PASSWORD_AUTH_DISABLED_MESSAGE =
    'Password sign-in is disabled here — use a passkey to sign in.';
