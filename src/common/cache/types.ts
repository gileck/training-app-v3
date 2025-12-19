/**
 * Types for the caching system
 */

export interface CacheOptions {
    /** Time-to-live in milliseconds. Default: 1 hour */
    ttl?: number;
    /** Whether to bypass cache and force a fresh execution. Default: false */
    bypassCache?: boolean;
    /** Whether to disable cache and force a fresh execution, and not save the result to cache. Default: false */
    disableCache?: boolean;
    /** Whether to return stale data immediately while revalidating in background. Default: false */
    staleWhileRevalidate?: boolean;
    /** Maximum age for stale data in milliseconds. If data is older than this, fetch fresh data instead. Default: 7 days */
    maxStaleAge?: number;
    /** Maximum cache size in bytes. When exceeded, oldest entries will be evicted. Default: 4MB */
    maxCacheSize?: number;
    /** Time-to-live for stale data in milliseconds. Default: 10 seconds */
    isStaleTTL?: number;
    /** Callback to validate if data should be cached. If returns false, data is not cached and existing cache is deleted. */
    isDataValidForCache?: <T>(data: T) => boolean;
}

export interface CacheMetadata {
    /** When the cache entry was created */
    createdAt: string;
    /** When the cache entry was last accessed (for LRU eviction) */
    lastAccessedAt: string;
    /** The cache key used to store this entry */
    key: string;
    /** The cache provider used (fs, s3, localStorage, or indexedDB) */
    provider: 'fs' | 's3' | 'localStorage' | 'indexedDB';
}

export interface CacheResult<T> {
    /** The result of the cached function */
    data: T;
    /** Whether the result was retrieved from cache */
    isFromCache: boolean;
    /** Metadata about the cache entry */
    metadata?: CacheMetadata;
}

export interface CacheStatus {
    /** Whether the cache entry exists */
    exists: boolean;
    /** Metadata about the cache entry if it exists */
    metadata?: CacheMetadata;
    /** Whether the cache entry has expired */
    isExpired?: boolean;
}

export interface CacheParams {
    /** Unique identifier for the cache entry */
    key: string;
    /** Additional parameters to include in the cache key */
    params?: Record<string, unknown>;
}

export interface CacheProvider {
    generateCacheKey(params: CacheParams): string;
    readCache<T>(cacheKey: string, ttl?: number): Promise<{ data: T; metadata: CacheMetadata } | null>;
    readCacheWithStale<T>(cacheKey: string, ttl?: number): Promise<{
        data: T;
        metadata: CacheMetadata;
        isStale: boolean;
    } | null>;
    writeCache<T>(cacheKey: string, data: T): Promise<CacheMetadata>;
    deleteCache(cacheKey: string): Promise<boolean>;
    clearAllCache(): Promise<boolean>;
    getCacheStatus(params: CacheParams, ttl?: number): Promise<CacheStatus>;
} 