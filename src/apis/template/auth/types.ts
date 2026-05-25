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
