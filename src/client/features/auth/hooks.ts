/**
 * Auth Feature Hooks
 * 
 * React Query hooks for authentication.
 */

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './store';
import { userToHint } from './types';
import { apiLogin, apiLogout, apiRegister, apiFetchCurrentUser } from '@/apis/auth/client';
import type { LoginRequest, RegisterRequest, CurrentUserResponse } from '@/apis/auth/types';

// ============================================================================
// Query Keys
// ============================================================================

export const currentUserQueryKey = ['auth', 'currentUser'] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch the current authenticated user
 */
export function useCurrentUser(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: currentUserQueryKey,
        queryFn: async (): Promise<CurrentUserResponse> => {
            const response = await apiFetchCurrentUser();
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: options?.enabled ?? true,
        staleTime: 5 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        retry: (failureCount, error) => {
            if (error instanceof Error &&
                (error.message.includes('401') ||
                    error.message.includes('unauthorized') ||
                    error.message.includes('Unauthorized'))) {
                return false;
            }
            return failureCount < 2;
        },
    });
}

/**
 * Hook to invalidate current user query
 */
export function useInvalidateCurrentUser() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
}

// ============================================================================
// Auth Validation Hook (Instant Boot)
// ============================================================================

/**
 * Implements the instant-boot auth pattern:
 * 1. Zustand hydrates `isProbablyLoggedIn` from localStorage
 * 2. If hint exists: show app immediately (instant boot)
 * 3. Always validate with /me on first load (supports cookie-only sessions)
 * 4. On success: update user state; on error: clear auth and show login
 */
export function useAuthValidation() {
    const {
        isProbablyLoggedIn,
        userPublicHint,
        isValidated,
        isValidating,
        user,
        setValidatedUser,
        setValidating,
        setError,
        clearAuth,
    } = useAuthStore();

    const hasValidated = useRef(false);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: currentUserQueryKey,
        queryFn: async () => {
            const response = await apiFetchCurrentUser();
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // Always validate on first load - supports cookie-only sessions
        enabled: !hasValidated.current,
        retry: (failureCount, error) => {
            // Don't retry auth errors
            if (error instanceof Error &&
                (error.message.includes('401') ||
                    error.message.includes('unauthorized') ||
                    error.message.includes('Unauthorized') ||
                    error.message.includes('Not authenticated'))) {
                return false;
            }
            return failureCount < 2;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });

    useEffect(() => {
        if (isLoading) {
            setValidating(true);
            return;
        }

        if (data?.user && !isError) {
            hasValidated.current = true;
            setValidatedUser(data.user);
            return;
        }

        if (isError || (data && !data.user)) {
            hasValidated.current = true;
            // Clear auth hint if it was set (stale session)
            if (isProbablyLoggedIn) {
                clearAuth();
            }
            // Mark validation as complete (not validating anymore)
            setValidating(false);
            if (error instanceof Error) {
                setError(error.message);
            }
        }
    }, [data, isLoading, isError, error, isProbablyLoggedIn, setValidatedUser, setValidating, clearAuth, setError]);

    const revalidate = async () => {
        hasValidated.current = false;
        setValidating(true);
        await refetch();
    };

    return {
        isAuthenticated: isValidated && !!user,
        isProbablyLoggedIn,
        user,
        userHint: userPublicHint,
        isValidating: isLoading || isValidating,
        isValidated,
        error: error instanceof Error ? error.message : null,
        revalidate,
    };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useLogin() {
    const queryClient = useQueryClient();
    const { setValidatedUser, setUserHint, setError } = useAuthStore();

    return useMutation({
        mutationFn: async (credentials: LoginRequest) => {
            const response = await apiLogin(credentials);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            if (!response.data?.user) {
                throw new Error('Login failed: No user returned');
            }
            return response.data.user;
        },
        onSuccess: (user) => {
            setValidatedUser(user);
            setUserHint(userToHint(user));
            queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
        },
        onError: (error) => {
            setError(error instanceof Error ? error.message : 'Login failed');
        },
    });
}

export function useRegister() {
    const queryClient = useQueryClient();
    const { setValidatedUser, setUserHint, setError } = useAuthStore();

    return useMutation({
        mutationFn: async (data: RegisterRequest) => {
            const response = await apiRegister(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            if (!response.data?.user) {
                throw new Error('Registration failed: No user returned');
            }
            return response.data.user;
        },
        onSuccess: (user) => {
            setValidatedUser(user);
            setUserHint(userToHint(user));
            queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
        },
        onError: (error) => {
            setError(error instanceof Error ? error.message : 'Registration failed');
        },
    });
}

export function useLogout() {
    const queryClient = useQueryClient();
    const { clearAuth } = useAuthStore();

    return useMutation({
        mutationFn: async () => {
            const response = await apiLogout();
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        onSuccess: () => {
            clearAllLocalData(clearAuth, queryClient);
        },
        onError: () => {
            // Still clear local data even if server logout fails
            clearAllLocalData(clearAuth, queryClient);
        },
    });
}

/**
 * Clears all local data on logout:
 * - Auth store
 * - React Query cache
 * - Settings store
 * - Router store
 * - IndexedDB cache
 * - Offline queue
 * - All app-related localStorage
 */
async function clearAllLocalData(
    clearAuth: () => void,
    queryClient: ReturnType<typeof useQueryClient>
) {
    // Clear auth store
    clearAuth();

    // Clear React Query cache
    queryClient.clear();

    // Clear other storage by removing their localStorage keys
    if (typeof window !== 'undefined') {
        localStorage.removeItem('settings-storage');
        localStorage.removeItem('route-storage');
        localStorage.removeItem('apiClient_offline_post_queue_v1');
        // Clear React Query persisted cache
        localStorage.removeItem('react-query-cache-v2');
    }

    // Reload to reset all in-memory state
    if (typeof window !== 'undefined') {
        window.location.href = '/';
    }
}

