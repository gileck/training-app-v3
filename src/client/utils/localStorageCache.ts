/**
 * ⚠️ CURRENTLY UNUSED - Kept for potential future use
 * 
 * This file provides a localStorage-based cache provider for API responses.
 * As of Dec 2025, React Query handles all client-side caching, so this
 * API cache layer is not being used. We're keeping it in case we need
 * a separate API cache in the future (e.g., for non-React Query use cases).
 * 
 * See: apiClient.ts (simplified to use React Query only)
 */

import { CacheMetadata, CacheParams, CacheStatus, CacheProvider } from '@/common/cache/types';

/**
 * Default maximum cache size (4MB)
 */
const DEFAULT_MAX_CACHE_SIZE = 2 * 1024 * 1024;

/**
 * Cache storage key in localStorage
 */
const CACHE_STORAGE_KEY = 'app_cache';

/**
 * Cache storage structure
 */
interface CacheStorage {
    entries: Record<string, { data: unknown; metadata: CacheMetadata }>;
}

/**
 * Estimates the size of the cache storage in bytes
 */
const estimateCacheSize = (storage: CacheStorage): number => {
    // localStorage stores as UTF-16, so each character is 2 bytes
    return JSON.stringify(storage).length * 2;
};

/**
 * Gets the cache storage from localStorage
 */
const getCacheStorage = (): CacheStorage => {
    if (typeof window === 'undefined') {
        return { entries: {} };
    }

    try {
        const stored = localStorage.getItem(CACHE_STORAGE_KEY);
        if (!stored) {
            return { entries: {} };
        }
        return JSON.parse(stored);
    } catch {
        return { entries: {} };
    }
};

/**
 * Saves the cache storage to localStorage
 */
const saveCacheStorage = (storage: CacheStorage, maxCacheSize?: number): void => {
    if (typeof window === 'undefined') {
        return;
    }

    const maxSize = maxCacheSize || DEFAULT_MAX_CACHE_SIZE;

    try {
        const serialized = JSON.stringify(storage);
        localStorage.setItem(CACHE_STORAGE_KEY, serialized);

        // Check if we've exceeded max cache size
        const currentSize = estimateCacheSize(storage);
        if (currentSize > maxSize) {
            // Clean up 25% of max size to provide some buffer
            const targetCleanup = maxSize * 0.25;
            cleanupCache(storage, targetCleanup);
            // Save again after cleanup
            localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(storage));
        }
    } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            // Storage quota exceeded, try to clean up and retry
            console.warn('localStorage quota exceeded, cleaning up cache...');

            const entrySize = JSON.stringify(storage).length * 2;
            const currentSize = estimateCacheSize(storage);

            // Clean up enough space for this entry plus 25% buffer
            const targetCleanup = Math.max(entrySize * 0.25, currentSize * 0.25);

            if (cleanupCache(storage, targetCleanup)) {
                try {
                    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(storage));
                } catch (retryError) {
                    console.error('Failed to write to localStorage after cleanup:', retryError);
                    throw new Error('Failed to write to localStorage cache after cleanup');
                }
            } else {
                throw new Error('Failed to free enough localStorage space');
            }
        } else {
            throw error;
        }
    }
};

/**
 * Cleans up cache entries to free space (modifies storage in-place)
 */
const cleanupCache = (storage: CacheStorage, targetSize: number): boolean => {
    const entries = Object.entries(storage.entries);

    // Sort by lastAccessedAt (LRU) then by createdAt (oldest first)
    entries.sort(([, a], [, b]) => {
        const aAccessed = new Date(a.metadata.lastAccessedAt || a.metadata.createdAt).getTime();
        const bAccessed = new Date(b.metadata.lastAccessedAt || b.metadata.createdAt).getTime();
        return aAccessed - bAccessed;
    });

    let freedSize = 0;
    const initialSize = estimateCacheSize(storage);

    for (const [key, entry] of entries) {
        if (freedSize >= targetSize) {
            break;
        }

        const entrySize = JSON.stringify({ [key]: entry }).length * 2;
        delete storage.entries[key];
        freedSize += entrySize;
    }

    const finalSize = estimateCacheSize(storage);
    return (initialSize - finalSize) >= targetSize;
};

/**
 * Hash function for client-side
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
 * localStorage Cache Provider
 */
export const localStorageCacheProvider: CacheProvider = {
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
     * Reads a cache entry from localStorage
     */
    readCache: async <T>(cacheKey: string, ttl?: number): Promise<{ data: T; metadata: CacheMetadata } | null> => {
        if (typeof window === 'undefined') {
            return null;
        }

        try {
            const storage = getCacheStorage();
            const entry = storage.entries[cacheKey];

            if (!entry) {
                return null;
            }

            // Check if the cache has expired using provided TTL or default
            const cacheTtl = ttl || 3600000; // 1 hour default
            if (new Date(entry.metadata.createdAt).getTime() + cacheTtl < Date.now()) {
                delete storage.entries[cacheKey];
                saveCacheStorage(storage);
                return null;
            }

            // Update last accessed time
            entry.metadata.lastAccessedAt = new Date().toISOString();
            saveCacheStorage(storage);

            return { data: entry.data as T, metadata: entry.metadata };
        } catch (error) {
            console.error('Failed to read cache from localStorage:', error);
            return null;
        }
    },

    /**
     * Reads a cache entry from localStorage including stale data
     */
    readCacheWithStale: async <T>(cacheKey: string, ttl?: number): Promise<{
        data: T;
        metadata: CacheMetadata;
        isStale: boolean;
    } | null> => {
        if (typeof window === 'undefined') {
            return null;
        }

        try {
            const storage = getCacheStorage();
            const entry = storage.entries[cacheKey];

            if (!entry) {
                return null;
            }

            const cacheTtl = ttl || 3600000;
            const isStale = new Date(entry.metadata.createdAt).getTime() + cacheTtl < Date.now();

            // Update last accessed time
            entry.metadata.lastAccessedAt = new Date().toISOString();
            saveCacheStorage(storage);

            return { data: entry.data as T, metadata: entry.metadata, isStale };
        } catch (error) {
            console.error('Failed to read cache from localStorage:', error);
            return null;
        }
    },

    /**
     * Writes a cache entry to localStorage
     */
    writeCache: async <T>(cacheKey: string, data: T): Promise<CacheMetadata> => {
        if (typeof window === 'undefined') {
            throw new Error('localStorage not available');
        }

        const now = new Date();

        const metadata: CacheMetadata = {
            createdAt: now.toISOString(),
            lastAccessedAt: now.toISOString(),
            key: cacheKey,
            provider: 'localStorage'
        };

        try {
            const storage = getCacheStorage();
            storage.entries[cacheKey] = { data, metadata };
            saveCacheStorage(storage);
            return metadata;
        } catch (error) {
            console.error('Failed to write cache to localStorage:', error);
            throw new Error('Failed to write to localStorage cache');
        }
    },

    /**
     * Deletes a cache entry from localStorage
     */
    deleteCache: async (cacheKey: string): Promise<boolean> => {
        if (typeof window === 'undefined') {
            return false;
        }

        try {
            const storage = getCacheStorage();
            if (storage.entries[cacheKey]) {
                delete storage.entries[cacheKey];
                saveCacheStorage(storage);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to delete cache from localStorage:', error);
            return false;
        }
    },

    /**
     * Clears all cache entries from localStorage
     */
    clearAllCache: async (): Promise<boolean> => {
        if (typeof window === 'undefined') {
            return false;
        }

        try {
            localStorage.removeItem(CACHE_STORAGE_KEY);
            return true;
        } catch (error) {
            console.error('Failed to clear all cache from localStorage:', error);
            return false;
        }
    },

    /**
     * Gets the status of a cache entry in localStorage
     */
    getCacheStatus: async (params: CacheParams, ttl?: number): Promise<CacheStatus> => {
        if (typeof window === 'undefined') {
            return { exists: false };
        }

        const cacheKey = localStorageCacheProvider.generateCacheKey(params);

        try {
            const storage = getCacheStorage();
            const entry = storage.entries[cacheKey];

            if (!entry) {
                return { exists: false };
            }

            const cacheTtl = ttl || 3600000;
            const isExpired = new Date(entry.metadata.createdAt).getTime() + cacheTtl < Date.now();

            return {
                exists: true,
                metadata: entry.metadata,
                isExpired,
            };
        } catch (error) {
            console.error('Failed to get cache status from localStorage:', error);
            return { exists: false };
        }
    }
}; 