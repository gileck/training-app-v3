/**
 * Centralized Configuration Defaults
 * 
 * All cache/persistence configuration lives here.
 * Features use these defaults automatically, with ability to override.
 */

// ============================================================================
// Time Constants (single source of truth)
// ============================================================================

export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
} as const;

// ============================================================================
// Zustand Store Defaults
// ============================================================================

export const STORE_DEFAULTS = {
    /** Default TTL for persisted state (7 days) */
    TTL: 7 * TIME.DAY,

    /** Short-lived state TTL (1 day) */
    TTL_SHORT: 1 * TIME.DAY,

    /** Long-lived state TTL (30 days) */
    TTL_LONG: 30 * TIME.DAY,

    /** Auth hint TTL - how long to trust cached login state */
    TTL_AUTH_HINT: 7 * TIME.DAY,

    /** Route persistence TTL - how long to remember last route */
    TTL_ROUTE: 30 * TIME.DAY,
} as const;

// ============================================================================
// React Query Cache Defaults
// ============================================================================

export const QUERY_DEFAULTS = {
    /** How long data is considered "fresh" (won't refetch) - used when SWR is ON */
    STALE_TIME: 30 * TIME.SECOND,

    /** How long to keep data in memory after component unmounts - used when SWR is ON */
    GC_TIME: 30 * TIME.MINUTE,

    /** localStorage persistence max age */
    PERSIST_MAX_AGE: 7 * TIME.DAY,
} as const;

export const MUTATION_DEFAULTS = {
    /** Mutations don't retry by default (handled by offline queue) */
    retry: 0,
} as const;

// ============================================================================
// Zustand Store Helpers
// ============================================================================

/**
 * Create TTL validation helper for stores that need custom expiry logic.
 * 
 * @example
 * ```typescript
 * const isValid = createTTLValidator(STORE_DEFAULTS.TTL_AUTH_HINT);
 * if (!isValid(state.hintTimestamp)) {
 *     // Clear expired state
 * }
 * ```
 */
export function createTTLValidator(ttl: number) {
    return (timestamp: number | null | undefined): boolean => {
        if (!timestamp) return false;
        return Date.now() - timestamp < ttl;
    };
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Add timestamp field to state interface for TTL tracking
 */
export interface WithTimestamp {
    _persistedAt?: number;
}
