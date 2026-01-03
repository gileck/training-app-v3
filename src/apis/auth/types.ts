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
};
export type LogoutResponse = {
    success: boolean;
    error?: string;
};

export interface UpdateProfileRequest {
    username?: string;
    profilePicture?: string;
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
    isAdmin: boolean;
}

export interface AuthTokenPayload {
    userId: string;
}

export interface ApiHandlerContext {
    userId?: string;
    isAdmin: boolean;
    getCookieValue: (name: string) => string | undefined;
    setCookie: (name: string, value: string, options: Record<string, unknown>) => void;
    clearCookie: (name: string, options: Record<string, unknown>) => void;
} 