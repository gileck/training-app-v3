import React, { useMemo } from 'react';
import { QueryClientProvider, useIsRestoring } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { getQueryClient } from './queryClient';
import { createLocalStoragePersister } from './persister';
import { defaultSettings } from '@/client/features/settings/types';

interface QueryProviderProps {
    children: React.ReactNode;
}

/**
 * Get cache persist days from localStorage settings.
 * Falls back to default if settings not available yet.
 */
function getCachePersistDays(): number {
    if (typeof window === 'undefined') return defaultSettings.cachePersistDays;
    
    try {
        const stored = localStorage.getItem('settings-storage');
        if (stored) {
            const parsed = JSON.parse(stored);
            const days = parsed?.state?.settings?.cachePersistDays;
            if (typeof days === 'number' && days > 0) {
                return days;
            }
        }
    } catch {
        // Ignore parse errors
    }
    return defaultSettings.cachePersistDays;
}

/**
 * Wrapper that waits for React Query cache restoration.
 * 
 * Note: We always render children immediately (no blocking).
 * The singleton persister pattern prevents re-restore on re-render.
 * Components handle their own loading states via isLoading checks.
 */
function WaitForCacheRestore({ children }: { children: React.ReactNode }) {
    // Track restore status (used internally by React Query)
    useIsRestoring();
    return <>{children}</>;
}

/**
 * React Query persistence using localStorage.
 * 
 * We previously used IndexedDB (createIDBPersister) but it was too slow on some systems
 * (5+ second delays during app startup, Dec 2025). This may be a browser bug or
 * machine-specific issue that could be resolved in future browser updates.
 * 
 * localStorage is limited to ~5MB but is consistently fast (~1ms reads).
 * Since React Query cache (excluding reports) is typically <100KB, localStorage works well.
 * We plan to re-test IndexedDB periodically as the app grows and may need larger cache storage.
 * 
 * TO SWITCH BACK TO INDEXEDDB:
 * When IndexedDB performance improves or larger storage is needed, change:
 *   createLocalStoragePersister() → createIDBPersister()
 * Both are implemented in ./persister.ts
 */
const USE_REACT_QUERY_PERSISTENCE = true;
const persister = (USE_REACT_QUERY_PERSISTENCE && typeof window !== 'undefined') ? createLocalStoragePersister() : null;

// Query keys that should NOT be persisted to IndexedDB
// These are either too large or not worth caching
const EXCLUDED_QUERY_KEYS = [
    'reports', // Reports contain huge session logs and performance entries
];

// Dehydrate options - stable reference at module level
const dehydrateOptions = {
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string; error: unknown } }) => {
        // Only persist successful queries
        if (query.state.status !== 'success') {
            return false;
        }
        // Don't persist queries with errors
        if (query.state.error) {
            return false;
        }
        // Don't persist excluded query keys (e.g., large reports data)
        const firstKey = query.queryKey[0];
        if (typeof firstKey === 'string' && EXCLUDED_QUERY_KEYS.includes(firstKey)) {
            return false;
        }
        // Don't persist mutations
        return true;
    },
};

/**
 * React Query provider with localStorage persistence
 * 
 * Persistence uses localStorage. Cache restore is tracked but app rendering is not blocked.
 * Components handle their own loading states via isLoading checks.
 * 
 * IMPORTANT: The persister is a module-level singleton to prevent re-restore
 * when the component re-renders (e.g., on network state change).
 */
export function QueryProvider({ children }: QueryProviderProps) {
    const queryClient = getQueryClient();

    // Get persist max age from settings (read once on mount)
    const persistMaxAge = useMemo(() => {
        const days = getCachePersistDays();
        return days * 24 * 60 * 60 * 1000; // Convert days to ms
    }, []);

    // Only use persistence on client side
    if (!persister) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    }

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge: persistMaxAge,
                dehydrateOptions,
            }}
        >
            <WaitForCacheRestore>
                {children}
            </WaitForCacheRestore>
        </PersistQueryClientProvider>
    );
}

export default QueryProvider;
