/**
 * Settings Utility Functions
 */

import {
    getTotalCacheSize,
    getCacheSizeBreakdown,
    printAllStores,
    type CacheSizeInfo,
} from '@/client/stores';
import { formatBytes } from '@/client/lib/utils';

// React Query cache key (not managed by store registry)
export const REACT_QUERY_CACHE_KEY = 'react-query-cache-v2';

// localStorage limit is typically ~5MB
export const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;

export interface CacheSizeState {
    total: { bytes: number; formatted: string };
    breakdown: Array<{ name: string; key: string; bytes: number; formatted: string }>;
}

/**
 * Get combined cache size including both store registry and React Query
 */
export function getCombinedCacheSize(): CacheSizeState {
    // Get store registry sizes
    const storeTotal = getTotalCacheSize();
    const storeBreakdown = getCacheSizeBreakdown();

    // Get React Query cache size
    let reactQueryBytes = 0;
    try {
        const rqData = localStorage.getItem(REACT_QUERY_CACHE_KEY);
        reactQueryBytes = rqData ? new Blob([rqData]).size : 0;
    } catch {
        reactQueryBytes = 0;
    }

    // Combine totals
    const totalBytes = storeTotal.bytes + reactQueryBytes;

    // Build breakdown with React Query included
    const breakdown: CacheSizeState['breakdown'] = [
        ...storeBreakdown.map((item: CacheSizeInfo) => ({
            name: item.label,
            key: item.key,
            bytes: item.bytes,
            formatted: item.formatted,
        })),
    ];

    // Add React Query to breakdown
    if (reactQueryBytes > 0) {
        breakdown.push({
            name: 'React Query',
            key: REACT_QUERY_CACHE_KEY,
            bytes: reactQueryBytes,
            formatted: formatBytes(reactQueryBytes),
        });
    }

    // Sort by size descending
    breakdown.sort((a, b) => b.bytes - a.bytes);

    return {
        total: { bytes: totalBytes, formatted: formatBytes(totalBytes) },
        breakdown,
    };
}

/**
 * Print all cached data to console for debugging
 */
export function printCacheToConsole(): void {
    // Print store registry data
    printAllStores();

    // Also print React Query cache
    console.group('[Cache Debug] React Query');
    try {
        const cacheStr = localStorage.getItem(REACT_QUERY_CACHE_KEY);
        if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            const queries = cache?.clientState?.queries || [];

            console.log('Total queries:', queries.length);
            console.log('Cache timestamp:', cache?.timestamp ? new Date(cache.timestamp).toLocaleString() : 'N/A');
            console.log('Total size:', formatBytes(new Blob([cacheStr]).size));
            console.log('---');

            // Print each query with its size
            queries.forEach((query: { queryKey: unknown; state: { data: unknown } }, index: number) => {
                const querySize = new Blob([JSON.stringify(query)]).size;
                console.log(`${index + 1}. [${formatBytes(querySize)}]`, query.queryKey);
            });

            console.log('---');
            console.log('Full cache object:', cache);
        } else {
            console.log('(empty)');
        }
    } catch (error) {
        console.error('Failed to parse React Query cache', error);
    }
    console.groupEnd();
}
