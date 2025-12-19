/**
 * React Query Default Options
 * 
 * All cache configuration is centralized in @/client/config.
 * This file provides hooks that apply those defaults to React Query.
 */

import { useSettingsStore } from '@/client/features/settings';
import { QUERY_DEFAULTS, MUTATION_DEFAULTS } from '@/client/config';

// Re-export for convenience (single import)
export { QUERY_DEFAULTS, MUTATION_DEFAULTS } from '@/client/config';

// Legacy alias for backwards compatibility
export const CACHE_TIMES = {
    STALE_TIME: QUERY_DEFAULTS.STALE_TIME,
    GC_TIME: QUERY_DEFAULTS.GC_TIME,
    MAX_STALE_AGE: QUERY_DEFAULTS.MAX_STALE_AGE,
} as const;

/**
 * Returns default React Query options based on user settings.
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
    const staleWhileRevalidate = useSettingsStore((s) => s.settings.staleWhileRevalidate);

    return {
        // If SWR enabled: data is fresh for STALE_TIME, then refetch in background
        // If SWR disabled: always refetch on mount
        staleTime: staleWhileRevalidate ? QUERY_DEFAULTS.STALE_TIME : 0,
        gcTime: QUERY_DEFAULTS.GC_TIME,
    };
}

/**
 * Default options for mutations (no caching needed)
 */
export function useMutationDefaults() {
    return MUTATION_DEFAULTS;
}
