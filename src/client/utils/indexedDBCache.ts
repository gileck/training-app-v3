/**
 * ⚠️ CURRENTLY UNUSED - Kept for potential future use
 * 
 * This file provides an IndexedDB-based cache provider for API responses.
 * As of Dec 2025, React Query handles all client-side caching, so this
 * API cache layer is not being used. We're keeping it in case we need
 * a separate API cache in the future (e.g., for non-React Query use cases).
 * 
 * See: apiClient.ts (simplified to use React Query only)
 */

import { CacheMetadata, CacheParams, CacheStatus, CacheProvider } from '@/common/cache/types';
import { localStorageCacheProvider } from './localStorageCache';

/**
 * IndexedDB configuration
 */
const DB_NAME = 'app_cache_db';
const STORE_NAME = 'cache_entries';
const DB_VERSION = 1;

/**
 * Use localStorage instead of IndexedDB for API cache.
 * IndexedDB can be extremely slow on some systems (5+ seconds for small reads).
 * localStorage is limited to ~5MB but is consistently fast.
 */
const USE_LOCALSTORAGE_CACHE = true;

/**
 * Cache entry structure in IndexedDB
 */
interface CacheEntry {
    key: string;
    data: unknown;
    metadata: CacheMetadata;
}

/**
 * Opens the IndexedDB database
 */
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            reject(new Error('IndexedDB not available'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(new Error('Failed to open IndexedDB'));
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
    });
};

/**
 * Hash function for client-side (same as localStorage)
 */
const createHash = (data: string): string => {
    let hash = 0;
    if (data.length === 0) return hash.toString();

    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
};

/**
 * Sorts object keys recursively to ensure consistent serialization
 */
const sortObjectKeys = (obj: Record<string, unknown>): Record<string, unknown> => {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys) as unknown as Record<string, unknown>;
    }

    return Object.keys(obj)
        .sort()
        .reduce((result, key) => {
            result[key] = sortObjectKeys(obj[key] as Record<string, unknown>);
            return result;
        }, {} as Record<string, unknown>);
};

/**
 * IndexedDB Cache Provider
 */
export const indexedDBCacheProvider: CacheProvider = {
    /**
     * Generates a cache key from the provided parameters
     */
    generateCacheKey: (params: CacheParams): string => {
        const { key, params: additionalParams } = params;

        // Create a stable representation of the parameters
        const paramsString = additionalParams
            ? JSON.stringify(sortObjectKeys(additionalParams))
            : '';

        // Generate a hash of the key and parameters
        const hash = createHash(`${key}:${paramsString}`);

        return `cache_${hash}`;
    },

    /**
     * Reads a cache entry from IndexedDB
     */
    readCache: async <T>(cacheKey: string, ttl?: number): Promise<{ data: T; metadata: CacheMetadata } | null> => {
        try {
            const db = await openDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(cacheKey);

                request.onerror = () => {
                    reject(new Error('Failed to read from IndexedDB'));
                };

                request.onsuccess = () => {
                    const entry = request.result as CacheEntry | undefined;

                    if (!entry) {
                        resolve(null);
                        return;
                    }

                    // Check if the cache has expired using provided TTL or default
                    const cacheTtl = ttl || 3600000; // 1 hour default
                    if (new Date(entry.metadata.createdAt).getTime() + cacheTtl < Date.now()) {
                        // Delete expired entry
                        const deleteTransaction = db.transaction([STORE_NAME], 'readwrite');
                        const deleteStore = deleteTransaction.objectStore(STORE_NAME);
                        deleteStore.delete(cacheKey);
                        resolve(null);
                        return;
                    }

                    // Update last accessed time
                    entry.metadata.lastAccessedAt = new Date().toISOString();
                    const updateTransaction = db.transaction([STORE_NAME], 'readwrite');
                    const updateStore = updateTransaction.objectStore(STORE_NAME);
                    updateStore.put(entry);

                    resolve({ data: entry.data as T, metadata: entry.metadata });
                };
            });
        } catch (error) {
            console.error('Failed to read cache from IndexedDB:', error);
            return null;
        }
    },

    /**
     * Reads a cache entry from IndexedDB including stale data
     */
    readCacheWithStale: async <T>(cacheKey: string, ttl?: number): Promise<{
        data: T;
        metadata: CacheMetadata;
        isStale: boolean;
    } | null> => {
        try {
            const db = await openDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(cacheKey);

                request.onerror = () => {
                    reject(new Error('Failed to read from IndexedDB'));
                };

                request.onsuccess = () => {
                    const entry = request.result as CacheEntry | undefined;

                    if (!entry) {
                        resolve(null);
                        return;
                    }

                    const cacheTtl = ttl || 3600000;
                    const isStale = new Date(entry.metadata.createdAt).getTime() + cacheTtl < Date.now();

                    // Update last accessed time
                    entry.metadata.lastAccessedAt = new Date().toISOString();
                    const updateTransaction = db.transaction([STORE_NAME], 'readwrite');
                    const updateStore = updateTransaction.objectStore(STORE_NAME);
                    updateStore.put(entry);

                    resolve({ data: entry.data as T, metadata: entry.metadata, isStale });
                };
            });
        } catch (error) {
            console.error('Failed to read cache from IndexedDB:', error);
            return null;
        }
    },

    /**
     * Writes a cache entry to IndexedDB
     */
    writeCache: async <T>(cacheKey: string, data: T): Promise<CacheMetadata> => {
        try {
            const db = await openDB();
            const now = new Date();

            const metadata: CacheMetadata = {
                createdAt: now.toISOString(),
                lastAccessedAt: now.toISOString(),
                key: cacheKey,
                provider: 'indexedDB'
            };

            const entry: CacheEntry = {
                key: cacheKey,
                data,
                metadata
            };

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(entry);

                request.onerror = () => {
                    reject(new Error('Failed to write to IndexedDB'));
                };

                request.onsuccess = () => {
                    resolve(metadata);
                };
            });
        } catch (error) {
            console.error('Failed to write cache to IndexedDB:', error);
            throw new Error('Failed to write to IndexedDB cache');
        }
    },

    /**
     * Deletes a cache entry from IndexedDB
     */
    deleteCache: async (cacheKey: string): Promise<boolean> => {
        try {
            const db = await openDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(cacheKey);

                request.onerror = () => {
                    reject(new Error('Failed to delete from IndexedDB'));
                };

                request.onsuccess = () => {
                    resolve(true);
                };
            });
        } catch (error) {
            console.error('Failed to delete cache from IndexedDB:', error);
            return false;
        }
    },

    /**
     * Clears all cache entries from IndexedDB
     */
    clearAllCache: async (): Promise<boolean> => {
        try {
            const db = await openDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();

                request.onerror = () => {
                    reject(new Error('Failed to clear IndexedDB'));
                };

                request.onsuccess = () => {
                    resolve(true);
                };
            });
        } catch (error) {
            console.error('Failed to clear all cache from IndexedDB:', error);
            return false;
        }
    },

    /**
     * Gets the status of a cache entry in IndexedDB
     */
    getCacheStatus: async (params: CacheParams, ttl?: number): Promise<CacheStatus> => {
        try {
            const cacheKey = indexedDBCacheProvider.generateCacheKey(params);
            const db = await openDB();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(cacheKey);

                request.onerror = () => {
                    reject(new Error('Failed to get cache status from IndexedDB'));
                };

                request.onsuccess = () => {
                    const entry = request.result as CacheEntry | undefined;

                    if (!entry) {
                        resolve({ exists: false });
                        return;
                    }

                    const cacheTtl = ttl || 3600000;
                    const isExpired = new Date(entry.metadata.createdAt).getTime() + cacheTtl < Date.now();

                    resolve({
                        exists: true,
                        metadata: entry.metadata,
                        isExpired,
                    });
                };
            });
        } catch (error) {
            console.error('Failed to get cache status from IndexedDB:', error);
            return { exists: false };
        }
    }
};

/**
 * Tests if IndexedDB is available
 */
const isIndexedDBAvailable = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.indexedDB) {
        return false;
    }

    try {
        // Try to open a test database
        await openDB();
        return true;
    } catch {
        return false;
    }
};

/**
 * Creates a smart cache provider that uses IndexedDB with localStorage fallback
 */
const createSmartProvider = (): CacheProvider => {
    let provider: CacheProvider | null = null;
    let providerPromise: Promise<CacheProvider> | null = null;

    const getProvider = async (): Promise<CacheProvider> => {
        if (provider) {
            return provider;
        }

        if (providerPromise) {
            return providerPromise;
        }

        providerPromise = (async () => {
            // Use localStorage for better performance (IndexedDB can be very slow)
            if (USE_LOCALSTORAGE_CACHE) {
                provider = localStorageCacheProvider;
                return provider;
            }
            const isAvailable = await isIndexedDBAvailable();
            provider = isAvailable ? indexedDBCacheProvider : localStorageCacheProvider;
            return provider;
        })();

        return providerPromise;
    };

    // Return a provider that delegates to the appropriate implementation
    return {
        generateCacheKey: (params: CacheParams): string => {
            // This is synchronous, so we use IndexedDB's implementation
            // (both have the same implementation anyway)
            return indexedDBCacheProvider.generateCacheKey(params);
        },

        readCache: async <T>(cacheKey: string, ttl?: number): Promise<{ data: T; metadata: CacheMetadata } | null> => {
            const p = await getProvider();
            return p.readCache<T>(cacheKey, ttl);
        },

        readCacheWithStale: async <T>(cacheKey: string, ttl?: number): Promise<{
            data: T;
            metadata: CacheMetadata;
            isStale: boolean;
        } | null> => {
            const p = await getProvider();
            return p.readCacheWithStale<T>(cacheKey, ttl);
        },

        writeCache: async <T>(cacheKey: string, data: T): Promise<CacheMetadata> => {
            const p = await getProvider();
            return p.writeCache<T>(cacheKey, data);
        },

        deleteCache: async (cacheKey: string): Promise<boolean> => {
            const p = await getProvider();
            return p.deleteCache(cacheKey);
        },

        clearAllCache: async (): Promise<boolean> => {
            const p = await getProvider();
            return p.clearAllCache();
        },

        getCacheStatus: async (params: CacheParams, ttl?: number): Promise<CacheStatus> => {
            const p = await getProvider();
            return p.getCacheStatus(params, ttl);
        }
    };
};

/**
 * Smart cache provider that automatically selects IndexedDB or localStorage
 */
export const clientCacheProvider = createSmartProvider();

