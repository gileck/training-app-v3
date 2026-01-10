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

export type LoginResponse = AuthResponse;
export type RegisterResponse = AuthResponse;

/**
 * Response from /me endpoint.
 * - { user: UserResponse } - authenticated user
 * - { user: null } - no session (not an error, just "no user")
 * - { error: string } - actual error (e.g., "User not found" if token valid but user deleted)
 */
export type CurrentUserResponse = {
    user?: UserResponse | null;
    error?: string;
    /** Debug info about auth status - helps diagnose auth failures */
    authDebug?: AuthDebugInfo;
};
export type LogoutResponse = {
    success: boolean;
    error?: string;
};

export interface UpdateProfileRequest {
    username?: string;
    profilePicture?: string;
    telegramChatId?: string;
}

export interface UpdateProfileResponse {
    success: boolean;
    user?: UserResponse;
    error?: string;
}

// User data returned to the client (without password)
export interface UserResponse {
    id: string;
    username: string;
    email?: string;
    createdAt: string;
    profilePicture?: string;
    telegramChatId?: string;
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
}

export interface ApiHandlerContext {
    userId?: string;
    isAdmin: boolean;
    /** Debug info about auth state - useful for diagnosing auth failures */
    authDebug: AuthDebugInfo;
    getCookieValue: (name: string) => string | undefined;
    setCookie: (name: string, value: string, options: Record<string, unknown>) => void;
    clearCookie: (name: string, options: Record<string, unknown>) => void;
} 