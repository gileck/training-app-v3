import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { logger } from '@/client/features/session-logs';
import { formatBytes } from '@/client/lib/utils';

const CACHE_KEY = 'react-query-cache';
const CACHE_BUSTER = 'v2'; // Increment to invalidate all cached data (v2: excluded reports from cache)

/**
 * Storage type for React Query persistence
 * - 'localStorage': Fast, but limited to ~5MB
 * - 'indexedDB': Larger capacity, but can be very slow on some systems
 */
export type StorageType = 'localStorage' | 'indexedDB';

/**
 * Maximum age for persisted cache (24 hours)
 * After this, the cache will be discarded and fresh data fetched
 */
const MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Calculate approximate size of an object in bytes
 */
function getObjectSize(obj: unknown): number {
    try {
        const str = JSON.stringify(obj);
        return new Blob([str]).size;
    } catch {
        return 0;
    }
}

/**
 * Thresholds for logging cache operations as warnings
 * Only log if duration > 500ms OR size > 1MB
 */
const SLOW_DURATION_THRESHOLD = 500; // ms
const LARGE_SIZE_THRESHOLD = 1024 * 1024; // 1MB

/**
 * Check if cache operation should be logged (only if slow or large)
 */
function shouldLogCacheOperation(duration: number, size: number): boolean {
    return duration > SLOW_DURATION_THRESHOLD || size > LARGE_SIZE_THRESHOLD;
}

/**
 * Create a localStorage persister for React Query
 * Fast but limited to ~5MB
 */
export function createLocalStoragePersister(): Persister {
    const key = `${CACHE_KEY}-${CACHE_BUSTER}`;

    return {
        persistClient: async (client: PersistedClient) => {
            try {
                const start = performance.now();
                const data = JSON.stringify(client);
                localStorage.setItem(key, data);
                const duration = Math.round(performance.now() - start);
                const size = data.length;
                
                // Only log if slow or large
                if (shouldLogCacheOperation(duration, size)) {
                    const queryCount = client.clientState?.queries?.length || 0;
                    logger.warn('cache', `React Query cache persisted slowly (localStorage)`, {
                        meta: { duration, size, sizeFormatted: formatBytes(size), queryCount }
                    });
                }
            } catch (error) {
                logger.error('cache', `Failed to persist React Query cache (localStorage)`, {
                    meta: { error: error instanceof Error ? error.message : String(error) }
                });
            }
        },
        restoreClient: async (): Promise<PersistedClient | undefined> => {
            try {
                const start = performance.now();
                const data = localStorage.getItem(key);
                const duration = Math.round(performance.now() - start);

                if (!data) {
                    return undefined;
                }

                const client = JSON.parse(data) as PersistedClient;
                const size = data.length;
                
                // Only log if slow or large
                if (shouldLogCacheOperation(duration, size)) {
                    const queryCount = client.clientState?.queries?.length || 0;
                    logger.warn('cache', `React Query cache restored slowly (localStorage)`, {
                        meta: { duration, size, sizeFormatted: formatBytes(size), queryCount }
                    });
                }

                // Check if cache is too old
                if (client.timestamp && Date.now() - client.timestamp > MAX_AGE) {
                    logger.warn('cache', `React Query cache expired, clearing (localStorage)`, {
                        meta: { cacheAge: Date.now() - client.timestamp, maxAge: MAX_AGE }
                    });
                    localStorage.removeItem(key);
                    return undefined;
                }

                return client;
            } catch (error) {
                logger.error('cache', `Failed to restore React Query cache (localStorage)`, {
                    meta: { error: error instanceof Error ? error.message : String(error) }
                });
                return undefined;
            }
        },
        removeClient: async () => {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                logger.error('cache', `Failed to remove React Query cache (localStorage)`, {
                    meta: { error: error instanceof Error ? error.message : String(error) }
                });
            }
        },
    };
}

/**
 * Create an IndexedDB persister for React Query
 * Uses idb-keyval for simple key-value storage
 * Note: Can be very slow on some systems
 */
export function createIDBPersister(): Persister {
    return {
        persistClient: async (client: PersistedClient) => {
            try {
                const start = performance.now();
                await set(`${CACHE_KEY}-${CACHE_BUSTER}`, client);
                const duration = Math.round(performance.now() - start);
                const size = getObjectSize(client);
                
                // Only log if slow or large
                if (shouldLogCacheOperation(duration, size)) {
                    const queryCount = client.clientState?.queries?.length || 0;
                    logger.warn('cache', `React Query cache persisted slowly (IndexedDB)`, {
                        meta: { duration, size, sizeFormatted: formatBytes(size), queryCount }
                    });
                }
            } catch (error) {
                logger.error('cache', `Failed to persist React Query cache (IndexedDB)`, {
                    meta: { error: error instanceof Error ? error.message : String(error) }
                });
            }
        },
        restoreClient: async (): Promise<PersistedClient | undefined> => {
            try {
                const start = performance.now();
                const client = await get<PersistedClient>(`${CACHE_KEY}-${CACHE_BUSTER}`);
                const duration = Math.round(performance.now() - start);

                if (!client) {
                    return undefined;
                }

                const size = getObjectSize(client);
                
                // Only log if slow or large
                if (shouldLogCacheOperation(duration, size)) {
                    const queryCount = client.clientState?.queries?.length || 0;
                    logger.warn('cache', `React Query cache restored slowly (IndexedDB)`, {
                        meta: { duration, size, sizeFormatted: formatBytes(size), queryCount }
                    });
                }

                // Check if cache is too old
                if (client.timestamp && Date.now() - client.timestamp > MAX_AGE) {
                    logger.warn('cache', `React Query cache expired, clearing (IndexedDB)`, {
                        meta: { cacheAge: Date.now() - client.timestamp, maxAge: MAX_AGE }
                    });
                    await del(`${CACHE_KEY}-${CACHE_BUSTER}`);
                    return undefined;
                }

                return client;
            } catch (error) {
                logger.error('cache', `Failed to restore React Query cache (IndexedDB)`, {
                    meta: { error: error instanceof Error ? error.message : String(error) }
                });
                return undefined;
            }
        },
        removeClient: async () => {
            try {
                await del(`${CACHE_KEY}-${CACHE_BUSTER}`);
            } catch (error) {
                logger.error('cache', `Failed to remove React Query cache (IndexedDB)`, {
                    meta: { error: error instanceof Error ? error.message : String(error) }
                });
            }
        },
    };
}

