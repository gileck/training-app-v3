/**
 * React Query Default Options
 * 
 * All cache configuration is centralized in @/client/config.
 * This file provides hooks that apply those defaults to React Query.
 */

import { useSettingsStore } from '@/client/features/template/settings';
import { QUERY_DEFAULTS, MUTATION_DEFAULTS } from '@/client/config';

// Re-export for convenience (single import)
export { QUERY_DEFAULTS, MUTATION_DEFAULTS } from '@/client/config';

// Legacy alias for backwards compatibility
export const CACHE_TIMES = {
    STALE_TIME: QUERY_DEFAULTS.STALE_TIME,
    GC_TIME: QUERY_DEFAULTS.GC_TIME,
} as const;

/**
 * Returns default React Query options based on user settings.
 * 
 * This is the SINGLE POINT OF CONTROL for React Query caching behavior.
 * 
 * - SWR ON (default): Caching enabled - serve cached data, refresh in background, offline works
 * - SWR OFF: No caching - always fetch fresh, never show cached data, offline won't work
 * 
 * Cache times are user-configurable via Settings:
 * - cacheStaleTimeSeconds: How long data is "fresh" (default: 30 seconds)
 * - cacheGcTimeMinutes: How long to keep in memory (default: 30 minutes)
 * 
 * Usage in hooks:
 * ```typescript
 * export function useTodos() {
 *     const queryDefaults = useQueryDefaults();
 *     return useQuery({
 *         queryKey: ['todos'],
 *         queryFn: () => fetchTodos(),
 *         ...queryDefaults,
 *     });
 * }
 * ```
 */
export function useQueryDefaults() {
    const settings = useSettingsStore((s) => s.settings);
    const { staleWhileRevalidate, cacheStaleTimeSeconds, cacheGcTimeMinutes } = settings;

    if (staleWhileRevalidate) {
        // SWR ON: Use user-configured cache times, offline works
        return {
            staleTime: (cacheStaleTimeSeconds ?? 30) * 1000, // Convert seconds to ms
            gcTime: (cacheGcTimeMinutes ?? 30) * 60 * 1000,  // Convert minutes to ms
        };
    }

    // SWR OFF: No caching at all, offline won't work
    return {
        staleTime: 0,
        gcTime: 0,
    };
}

/**
 * Default options for mutations (no caching needed)
 */
export function useMutationDefaults() {
    return MUTATION_DEFAULTS;
}
