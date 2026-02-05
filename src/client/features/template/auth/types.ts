/**
 * Auth Feature Types
 */

import type { UserResponse } from '@/apis/template/auth/types';

/**
 * Public user info stored as a hint for instant boot
 */
export interface UserPublicHint {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    isAdmin: boolean;
}

/**
 * Login form state
 */
export interface LoginFormState {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}

/**
 * Login form validation errors
 */
export interface LoginFormErrors {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}

/**
 * Convert UserResponse to UserPublicHint
 */
export function userToHint(user: UserResponse): UserPublicHint {
    return {
        id: user.id,
        name: user.username,
        email: user.email || '',
        avatar: user.profilePicture,
        isAdmin: user.isAdmin,
    };
}

