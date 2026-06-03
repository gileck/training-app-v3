import type { AuthMode } from './authMode';
import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
    AuthenticationResponseJSON,
} from '@simplewebauthn/browser';

export type TwoFactorMethod = 'telegram' | 'email';

export interface LoginRequest {
    username: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    email?: string;
    password: string;
}

export interface AuthResponse {
    user?: UserResponse;
    error?: string;
}

export interface LoginResponse extends AuthResponse {
    requiresTwoFactorApproval?: boolean;
    loginApprovalId?: string;
    loginApprovalToken?: string;
    loginApprovalMethod?: TwoFactorMethod;
    loginApprovalHint?: string;
    expiresAt?: string;
}

/**
 * Registration response. Has one of three shapes:
 * - { user: UserResponse } — success, user is logged in
 * - { pendingApproval: true } — admin-approved signups is enabled; account
 *   was created with 'pending' status and cannot log in until an admin
 *   approves it via /admin/approvals
 * - { error: string } — registration failed
 */
export interface RegisterResponse {
    user?: UserResponse;
    error?: string;
    pendingApproval?: boolean;
}

/**
 * Response from /me endpoint.
 * - { user: UserResponse } - authenticated user
 * - { user: null } - no session (not an error, just "no user")
 * - { error: string } - actual error (e.g., "User not found" if token valid but user deleted)
 */
export type CurrentUserResponse = {
    user?: UserResponse | null;
    error?: string;
    /** True when the error is due to a database connection failure, not an auth issue */
    connectionError?: boolean;
    /** Debug info about auth status - helps diagnose auth failures */
    authDebug?: AuthDebugInfo;
    /**
     * Active auth mode for this deployment ('password' | 'passkey'), surfaced
     * on the public preflight so the unauthenticated login UI knows which flow
     * to render without an extra round-trip. Always present.
     */
    authMode?: AuthMode;
};
export type LogoutResponse = {
    success: boolean;
    error?: string;
};

export interface UpdateProfileRequest {
    username?: string;
    email?: string;
    profilePicture?: string;
    notificationsEnabled?: boolean;
    telegramChatId?: string;
    twoFactorEnabled?: boolean;
    twoFactorMethod?: TwoFactorMethod;
}

export interface UpdateProfileResponse {
    success: boolean;
    user?: UserResponse;
    error?: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface ChangePasswordResponse {
    success: boolean;
    error?: string;
}

export interface RequestPasswordResetRequest {
    username: string;
}

/**
 * Always returns `{ success: true }` regardless of whether the username
 * exists or has Telegram configured. This is intentional anti-enumeration:
 * an unauthenticated attacker must not be able to learn which usernames
 * are registered or which have Telegram set up.
 */
export interface RequestPasswordResetResponse {
    success: boolean;
}

export interface ResetPasswordRequest {
    token: string;
    newPassword: string;
}

export interface ResetPasswordResponse {
    success: boolean;
    error?: string;
}

// User data returned to the client (without password)
export interface UserResponse {
    id: string;
    username: string;
    email?: string;
    createdAt: string;
    profilePicture?: string;
    notificationsEnabled?: boolean;
    telegramChatId?: string;
    twoFactorEnabled?: boolean;
    twoFactorMethod?: TwoFactorMethod;
    isAdmin: boolean;
}

export interface AuthTokenPayload {
    userId: string;
}

/**
 * Debug info about authentication status.
 * Helps diagnose why /me returns no user.
 */
export interface AuthDebugInfo {
    /** Was the auth cookie present in the request? */
    cookiePresent: boolean;
    /** If JWT verification failed, the error message */
    tokenError?: string;
    /** JWT error code (e.g., "TokenExpiredError", "JsonWebTokenError") */
    tokenErrorCode?: string;
    /** True when request was authenticated via ADMIN_API_TOKEN bearer + X-On-Behalf-Of */
    tokenAuth?: boolean;
}

// ============================================================
// Passkeys / WebAuthn (Phase 1: enroll a passkey for a logged-in user)
// ============================================================

/** A registered passkey as shown in the device-management UI. */
export interface PasskeyInfo {
    credentialId: string;
    deviceName?: string;
    backedUp?: boolean;
    createdAt: string;
    lastUsedAt?: string;
}

/** `passkey/register-options` — start the registration ceremony. */
export interface PasskeyRegisterOptionsResponse {
    options?: PublicKeyCredentialCreationOptionsJSON;
    /** Correlates this ceremony's two round-trips; echo back on verify. */
    challengeId?: string;
    error?: string;
}

/** `passkey/register-verify` — finish registration and store the credential. */
export interface PasskeyRegisterVerifyRequest {
    challengeId: string;
    response: RegistrationResponseJSON;
    /** Optional user-facing label for this device. */
    deviceName?: string;
}

export interface PasskeyRegisterVerifyResponse {
    verified: boolean;
    passkey?: PasskeyInfo;
    error?: string;
}

/** `passkey/list` — the current user's registered passkeys. */
export interface PasskeyListResponse {
    passkeys?: PasskeyInfo[];
    error?: string;
}

/** `passkey/rename` — relabel one of the current user's passkeys. */
export interface PasskeyRenameRequest {
    credentialId: string;
    deviceName: string;
}

export interface PasskeyRenameResponse {
    success: boolean;
    error?: string;
}

/** `passkey/delete` — remove one of the current user's passkeys. */
export interface PasskeyDeleteRequest {
    credentialId: string;
}

export interface PasskeyDeleteResponse {
    success: boolean;
    error?: string;
}

/** `passkey/login-options` — start discoverable ("just tap") login. */
export interface PasskeyLoginOptionsResponse {
    options?: PublicKeyCredentialRequestOptionsJSON;
    /** Correlates this ceremony's two round-trips; echo back on verify. */
    challengeId?: string;
    error?: string;
}

/** `passkey/login-verify` — verify the assertion and issue the session. */
export interface PasskeyLoginVerifyRequest {
    challengeId: string;
    response: AuthenticationResponseJSON;
}

export interface PasskeyLoginVerifyResponse {
    user?: UserResponse;
    error?: string;
}

/**
 * Token-authenticated enrollment (the universal enroll-link flow). Authorized
 * by a one-time enrollment token (from an admin-generated link or, later, an
 * email), NOT by an existing session — this is how a user with no passkey yet
 * registers their first device.
 */
export interface PasskeyEnrollOptionsRequest {
    token: string;
}

export interface PasskeyEnrollOptionsResponse {
    options?: PublicKeyCredentialCreationOptionsJSON;
    challengeId?: string;
    /** Who the link enrolls — shown on the landing page. */
    username?: string;
    error?: string;
}

export interface PasskeyEnrollVerifyRequest {
    token: string;
    challengeId: string;
    response: RegistrationResponseJSON;
    deviceName?: string;
}

export interface PasskeyEnrollVerifyResponse {
    verified: boolean;
    passkey?: PasskeyInfo;
    /** Present when a session was issued (user is now logged in on this device). */
    user?: UserResponse;
    error?: string;
}

/**
 * Step-up re-authentication: the logged-in user proves device possession again
 * (a fresh passkey assertion) before a sensitive page reveals its content.
 * Reuses the authentication ceremony restricted to the user's own passkeys.
 */
export interface PasskeyStepUpOptionsResponse {
    options?: PublicKeyCredentialRequestOptionsJSON;
    challengeId?: string;
    error?: string;
}

export interface PasskeyStepUpVerifyRequest {
    challengeId: string;
    response: AuthenticationResponseJSON;
}

export interface PasskeyStepUpVerifyResponse {
    verified: boolean;
    /** Server-clock ISO timestamp of a successful verification. */
    verifiedAt?: string;
    error?: string;
}

export interface ApiHandlerContext {
    userId?: string;
    isAdmin: boolean;
    /** Debug info about auth state - useful for diagnosing auth failures */
    authDebug: AuthDebugInfo;
    /** Originating user-agent header (may be undefined for non-HTTP callers). */
    userAgent?: string;
    /** Best-effort originating IP (X-Forwarded-For first hop, falls back to socket address). */
    ip?: string;
    /** Per-connection RPC bearer token (X-RPC-Connection-Token header). Required for gated RPC calls. */
    rpcConnectionToken?: string;
    getCookieValue: (name: string) => string | undefined;
    setCookie: (name: string, value: string, options: Record<string, unknown>) => void;
    clearCookie: (name: string, options: Record<string, unknown>) => void;
}
