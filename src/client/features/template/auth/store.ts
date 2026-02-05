/**
 * Auth Store
 * 
 * Manages authentication state with instant-boot support.
 * Persists only "hint" data for immediate UI rendering.
 * 
 * NOTE: All components using this store render AFTER BootGate ensures hydration.
 * Store values are guaranteed to be hydrated from localStorage.
 */

import { createStore } from '@/client/stores';
import type { UserPublicHint } from './types';
import { userToHint } from './types';
import type { UserResponse } from '@/apis/template/auth/types';
import { STORE_DEFAULTS, createTTLValidator } from '@/client/config';

// Use centralized TTL
const isHintValid = createTTLValidator(STORE_DEFAULTS.TTL_AUTH_HINT);

interface PersistedAuthState {
    isProbablyLoggedIn: boolean;
    userPublicHint: UserPublicHint | null;
    hintTimestamp: number | null;
}

interface AuthState extends PersistedAuthState {
    // Runtime state (not persisted)
    user: UserResponse | null;
    isValidated: boolean;
    isValidating: boolean;
    error: string | null;

    // Actions
    setUserHint: (user: UserPublicHint) => void;
    setValidatedUser: (user: UserResponse) => void;
    setValidating: (validating: boolean) => void;
    setError: (error: string | null) => void;
    clearAuth: () => void;
}

export const useAuthStore = createStore<AuthState>({
    key: 'auth-storage',
    label: 'Auth',
    creator: (set) => ({
        // Persisted state
        isProbablyLoggedIn: false,
        userPublicHint: null,
        hintTimestamp: null,

        // Runtime state
        user: null,
        isValidated: false,
        isValidating: false,
        error: null,

        setUserHint: (user) => {
            set({
                isProbablyLoggedIn: true,
                userPublicHint: user,
                hintTimestamp: Date.now(),
            });
        },

        setValidatedUser: (user) => {
            set({
                user,
                isValidated: true,
                isValidating: false,
                error: null,
                isProbablyLoggedIn: true,
                userPublicHint: userToHint(user),
                hintTimestamp: Date.now(),
            });
        },

        setValidating: (validating) => {
            // When starting validation, reset isValidated so effect can process new data
            // When stopping validation, mark as validated (regardless of success/failure)
            set({ 
                isValidating: validating,
                isValidated: !validating,  // false when starting, true when stopping
            });
        },

        setError: (error) => {
            set({ error, isValidating: false });
        },

        clearAuth: () => {
            set({
                isProbablyLoggedIn: false,
                userPublicHint: null,
                hintTimestamp: null,
                user: null,
                isValidated: true,  // Keep true so login dialog shows
                isValidating: false,
                error: null,
            });
        },
    }),
    persistOptions: {
        partialize: (state) => ({
            isProbablyLoggedIn: state.isProbablyLoggedIn,
            userPublicHint: state.userPublicHint,
            hintTimestamp: state.hintTimestamp,
        }),
        onRehydrateStorage: () => (state) => {
            // Clear stale hints on hydration
            if (state && !isHintValid(state.hintTimestamp)) {
                state.isProbablyLoggedIn = false;
                state.userPublicHint = null;
                state.hintTimestamp = null;
            }
        },
    },
});

// Selector hooks
export function useIsAuthenticated(): boolean {
    return useAuthStore((state) => state.isValidated && !!state.user);
}

export function useIsProbablyLoggedIn(): boolean {
    return useAuthStore((state) => state.isProbablyLoggedIn);
}

export function useUser(): UserResponse | null {
    return useAuthStore((state) => state.user);
}

export function useUserHint(): UserPublicHint | null {
    return useAuthStore((state) => state.userPublicHint);
}

export function useIsAdmin(): boolean {
    return useAuthStore((state) => {
        if (state.user?.isAdmin) return true;
        if (state.userPublicHint?.isAdmin) return true;
        return false;
    });
}
