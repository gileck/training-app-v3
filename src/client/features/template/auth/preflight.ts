/**
 * Auth Preflight
 * 
 * Pre-flights the /me API call as early as possible in the JS bundle.
 * This eliminates the waiting time for auth validation for cookie-authenticated users.
 * 
 * The preflight result is consumed by useAuthValidation hook.
 */

import { markPhaseStart, markPhaseEnd, markEvent, logStatus, BOOT_PHASES } from '../boot-performance';
import type { CurrentUserResponse } from '@/apis/auth/types';

interface PreflightResult {
    data: CurrentUserResponse | null;
    error: string | null;
    isComplete: boolean;
    /** True if preflight was skipped due to offline status */
    skippedOffline?: boolean;
}

// Global preflight state - persists across component mounts
let preflightPromise: Promise<PreflightResult> | null = null;
let preflightResult: PreflightResult | null = null;

/**
 * Start the preflight /me call immediately.
 * Call this as early as possible (e.g., in _app.tsx before React mounts).
 */
export function startAuthPreflight(): void {
    // Only run once
    if (preflightPromise) return;
    
    // Don't run on server
    if (typeof window === 'undefined') return;
    
    markPhaseStart(BOOT_PHASES.AUTH_PREFLIGHT_START);
    
    preflightPromise = (async (): Promise<PreflightResult> => {
        // Skip preflight when offline - let instant boot hints work
        if (!navigator.onLine) {
            markPhaseEnd(BOOT_PHASES.AUTH_PREFLIGHT_START);
            logStatus('Preflight Skipped (Offline)', { offline: true });
            const result: PreflightResult = {
                data: null,
                error: null,
                isComplete: true,
                skippedOffline: true,
            };
            preflightResult = result;
            return result;
        }
        
        try {
            // Use the same URL format as apiClient: slashes → underscores
            // POST with empty params, same as apiClient.call('auth/me')
            const response = await fetch('/api/process/auth_me', {
                method: 'POST',
                credentials: 'include', // Important: include cookies
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ params: {} }),
            });
            
            if (!response.ok) {
                // Non-2xx response - user not authenticated
                markPhaseEnd(BOOT_PHASES.AUTH_PREFLIGHT_START);
                markEvent(BOOT_PHASES.AUTH_PREFLIGHT_COMPLETE);
                
                const result: PreflightResult = {
                    data: { error: `HTTP ${response.status}` },
                    error: null,
                    isComplete: true,
                };
                preflightResult = result;
                return result;
            }
            
            const json = await response.json();
            const data = json.data || json;
            
            markPhaseEnd(BOOT_PHASES.AUTH_PREFLIGHT_START);
            markEvent(BOOT_PHASES.AUTH_PREFLIGHT_COMPLETE);
            
            // Log the /me response status with auth debug info
            logStatus('Preflight /me Response', {
                hasUser: !!data?.user,
                userId: data?.user?.id || null,
                username: data?.user?.username || null,
                // Auth debug info - helps diagnose why auth failed
                cookiePresent: data?.authDebug?.cookiePresent ?? 'unknown',
                tokenError: data?.authDebug?.tokenError || null,
                tokenErrorCode: data?.authDebug?.tokenErrorCode || null,
            });
            
            const result: PreflightResult = {
                data,
                error: null,
                isComplete: true,
            };
            preflightResult = result;
            return result;
        } catch (error) {
            markPhaseEnd(BOOT_PHASES.AUTH_PREFLIGHT_START);
            markEvent(BOOT_PHASES.AUTH_PREFLIGHT_COMPLETE);
            
            const errorMessage = error instanceof Error ? error.message : 'Preflight failed';
            logStatus('Preflight Network Error', {
                error: errorMessage,
                // Will preserve hints in handlePreflightResult
            });
            
            const result: PreflightResult = {
                data: null,
                error: errorMessage,
                isComplete: true,
            };
            preflightResult = result;
            return result;
        }
    })();
}

/**
 * Get the preflight result synchronously if available.
 * Returns null if preflight hasn't completed yet.
 */
export function getPreflightResult(): PreflightResult | null {
    return preflightResult;
}

/**
 * Wait for the preflight to complete.
 * Returns the result when available.
 */
export async function waitForPreflight(): Promise<PreflightResult | null> {
    if (!preflightPromise) return null;
    return preflightPromise;
}

/**
 * Check if preflight has completed
 */
export function isPreflightComplete(): boolean {
    return preflightResult?.isComplete ?? false;
}

/**
 * Reset preflight state (for testing or logout)
 */
export function resetPreflight(): void {
    preflightPromise = null;
    preflightResult = null;
}

// Start preflight immediately when this module is imported
// This runs as early as possible in the JS bundle
startAuthPreflight();
