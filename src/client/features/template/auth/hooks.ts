/**
 * Auth Feature Hooks
 * 
 * React Query hooks for authentication.
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './store';
import { userToHint } from './types';
import { apiLogin, apiLogout, apiRegister, apiFetchCurrentUser } from '@/apis/template/auth/client';
import { waitForPreflight, getPreflightResult, isPreflightComplete, resetPreflight } from './preflight';
import { markPhaseStart, markEvent, logStatus, BOOT_PHASES, printBootSummary } from '../boot-performance';
import type { LoginRequest, RegisterRequest, CurrentUserResponse } from '@/apis/template/auth/types';

// ============================================================================
// Query Keys
// ============================================================================

export const currentUserQueryKey = ['auth', 'currentUser'] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch the current authenticated user
 * 
 * Returns:
 * - { user: UserResponse } - authenticated user
 * - { user: null } - no session (normal for new users)
 * - throws Error - actual error (e.g., user deleted)
 */
export function useCurrentUser(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: currentUserQueryKey,
        queryFn: async (): Promise<CurrentUserResponse> => {
            const response = await apiFetchCurrentUser();
            // Only throw for actual errors, not for { user: null }
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            // Return response as-is (may have { user: null } or { user: UserResponse })
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
// Auth Validation Hook (Instant Boot with Preflight)
// ============================================================================

/**
 * Implements the instant-boot auth pattern with preflight optimization:
 * 
 * 1. Preflight: /me call starts immediately when JS loads (before React mounts)
 * 2. If preflight found a valid user: authenticate immediately (no flash)
 * 3. If preflight found no user: show login form immediately (no flash)
 * 4. Zustand hint is used as fallback only if preflight hasn't completed
 * 
 * For users with valid cookies: they never see login form (preflight authenticates them)
 * For new users: they see loading skeleton briefly, then login form
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
        clearAuth,
    } = useAuthStore();

    const hasValidated = useRef(false);
    const hasLoggedSummary = useRef(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- Ephemeral local state to track if preflight check is done
    const [preflightChecked, setPreflightChecked] = useState(isPreflightComplete());

    // Check preflight result on mount (non-blocking)
    // This effect intentionally has empty deps - it only runs once on mount
    useEffect(() => {
        if (hasValidated.current || isValidated) return;
        
        markPhaseStart(BOOT_PHASES.AUTH_VALIDATION_START);
        
        // Check if preflight already has result
        const existingResult = getPreflightResult();
        if (existingResult?.isComplete) {
            handlePreflightResult(existingResult);
            return;
        }
        
        // Wait for preflight to complete
        setValidating(true);
        waitForPreflight().then((result) => {
            if (result) {
                handlePreflightResult(result);
            } else {
                // No preflight available, fall back to regular query
                setPreflightChecked(true);
            }
        });
    }, [isValidated, setValidating]); // Only deps that don't cause re-runs

    const handlePreflightResult = (result: { data: CurrentUserResponse | null; error?: string | null; skippedOffline?: boolean }) => {
        if (hasValidated.current) return;
        
        const { data, error, skippedOffline } = result;
        
        // If offline OR network error, skip validation and let instant boot hints work
        // Network errors (fetch failed, DNS, timeout) should NOT clear hints
        if (skippedOffline || (error && !data)) {
            // Mark as validated to prevent fallback query from running
            hasValidated.current = true;
            markEvent(BOOT_PHASES.AUTH_VALIDATION_COMPLETE);
            logStatus('Auth Decision (Network Unavailable)', {
                decision: 'trust-hints',
                isProbablyLoggedIn,
                reason: skippedOffline ? 'skippedOffline' : 'network-error',
                error: error || null,
            });
            setPreflightChecked(true);
            setValidating(false);
            // DON'T clear hints - let isProbablyLoggedIn drive the UI
            if (!hasLoggedSummary.current) {
                hasLoggedSummary.current = true;
                setTimeout(() => printBootSummary(), 0);
            }
            return;
        }
        
        hasValidated.current = true;
        setPreflightChecked(true);
        
        if (data?.user) {
            // User is authenticated via cookie
            markEvent(BOOT_PHASES.AUTH_VALIDATION_COMPLETE);
            logStatus('Auth Decision', {
                decision: 'authenticated',
                userId: data.user.id,
                username: data.user.username,
            });
            setValidatedUser(data.user);
            markEvent(BOOT_PHASES.APP_CONTENT_SHOWN_VALIDATED);
        } else {
            // No valid session - clear any stale hints
            markEvent(BOOT_PHASES.AUTH_VALIDATION_COMPLETE);
            logStatus('Auth Decision', {
                decision: 'show-login',
                hadHint: isProbablyLoggedIn,
                reason: data?.error || 'no-session',
            });
            if (isProbablyLoggedIn) {
                clearAuth();
            }
            setValidating(false);
            markEvent(BOOT_PHASES.LOGIN_FORM_SHOWN);
        }
        
        // Print boot summary after auth is resolved
        if (!hasLoggedSummary.current) {
            hasLoggedSummary.current = true;
            setTimeout(() => printBootSummary(), 0);
        }
    };

    // Fallback query (only used if preflight fails or isn't available)
    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: currentUserQueryKey,
        queryFn: async () => {
            const response = await apiFetchCurrentUser();
            // Only throw for actual errors, not for { user: null }
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // Only run if preflight didn't complete
        enabled: preflightChecked && !hasValidated.current && !isValidated,
        retry: (failureCount, err) => {
            // Don't retry auth errors (actual errors like "User not found")
            if (err instanceof Error &&
                (err.message.includes('401') ||
                    err.message.includes('unauthorized') ||
                    err.message.includes('Unauthorized') ||
                    err.message.includes('User not found'))) {
                return false;
            }
            return failureCount < 2;
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });

    // Handle fallback query results
    useEffect(() => {
        if (!preflightChecked || hasValidated.current || isValidated) return;

        if (isLoading) {
            setValidating(true);
            return;
        }

        if (data?.user && !isError) {
            hasValidated.current = true;
            setValidatedUser(data.user);
            return;
        }

        // Distinguish between network errors and actual "no session" responses
        if (isError) {
            // Check if this is a network error vs actual auth error
            const isNetworkError = error instanceof Error && (
                error.message.includes('fetch') ||
                error.message.includes('network') ||
                error.message.includes('Failed to fetch') ||
                error.message.includes('NetworkError') ||
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('timeout')
            );
            
            if (isNetworkError) {
                // Network error - trust hints, don't clear auth
                hasValidated.current = true;
                logStatus('Auth Decision (Fallback Network Error)', {
                    decision: 'trust-hints',
                    isProbablyLoggedIn,
                    error: error.message,
                });
                setValidating(false);
                // DON'T clear hints - let isProbablyLoggedIn drive the UI
            } else {
                // Actual auth error (401, user not found, etc.) - clear hints
                hasValidated.current = true;
                if (isProbablyLoggedIn) {
                    clearAuth();
                }
                setValidating(false);
            }
            return;
        }

        // Server responded with { user: null } - no valid session, clear hints
        if (data && !data.user) {
            hasValidated.current = true;
            if (isProbablyLoggedIn) {
                clearAuth();
            }
            setValidating(false);
        }
    }, [data, isLoading, isError, error, preflightChecked, isProbablyLoggedIn, isValidated, setValidatedUser, setValidating, clearAuth]);

    const revalidate = async () => {
        hasValidated.current = false;
        setValidating(true);
        await refetch();
    };

    // Don't show as validating if already authenticated
    const effectiveIsValidating = isValidated ? false : (isLoading || isValidating || !preflightChecked);

    return {
        isAuthenticated: isValidated && !!user,
        isProbablyLoggedIn,
        user,
        userHint: userPublicHint,
        isValidating: effectiveIsValidating,
        isValidated,
        error: error instanceof Error ? error.message : null,
        revalidate,
    };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export function useLogin() {
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
        },
        onError: (error) => {
            setError(error instanceof Error ? error.message : 'Login failed');
        },
    });
}

export function useRegister() {
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
            // No need to invalidate /me query - user is already authenticated
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
 * - Auth preflight (so next user gets fresh /me call)
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
    
    // Reset preflight so next login gets fresh /me call
    resetPreflight();

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

