import { CacheOptions, CacheParams, CacheResult, CacheStatus, CacheProvider } from './types';

/**
 * Default cache options
 */
const DEFAULT_OPTIONS: CacheOptions = {
    isStaleTTL: 10000, // 10 seconds
    ttl: 3600000, // 1 hour
    bypassCache: false,
    maxStaleAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

/**
 * Helper function to check if a result has an error property
 */
function hasErrorProperty(result: unknown): boolean {
    return (
        result !== null &&
        typeof result === 'object' &&
        'error' in result &&
        result.error !== undefined &&
        result.error !== null
    );
}

/**
 * Creates a cache instance with the provided provider
 * @param provider The cache provider to use
 * @returns Cache functions that use the provided provider
 */
export const createCache = (provider: CacheProvider) => {
    /**
     * Executes a function with caching
     * @param callback The function to execute and cache
     * @param params Cache parameters for generating the cache key
     * @param options Cache options
     * @returns The result of the function execution and whether it came from cache
     */
    const withCache = async <T>(
        callback: () => Promise<T>,
        params: CacheParams,
        options?: CacheOptions
    ): Promise<CacheResult<T>> => {
        const opts = { ...DEFAULT_OPTIONS, ...options };
        const cacheKey = provider.generateCacheKey(params);

        // If disable cache is set, skip cache lookup
        if (opts.disableCache) {
            const result = await callback();
            return { data: result, isFromCache: false };
        }

        // If bypass cache is set, skip cache lookup but save the result to cache
        if (opts.bypassCache) {
            const result = await callback();

            // Check if data is valid for caching
            const isDataValid = opts.isDataValidForCache ? opts.isDataValidForCache(result) : true;
            
            if (!isDataValid) {
                // Delete existing cache if data is not valid
                await provider.deleteCache(cacheKey);
                return { data: result, isFromCache: false };
            }

            // Only cache successful results (no error property)
            if (!hasErrorProperty(result)) {
                const metadata = await provider.writeCache(cacheKey, result);
                return { data: result, isFromCache: false, metadata };
            }

            return { data: result, isFromCache: false };
        }

        // Check if we want stale-while-revalidate behavior
        if (opts.staleWhileRevalidate) {
            const staleResult = await provider.readCacheWithStale<T>(cacheKey, opts.isStaleTTL);

            if (staleResult) {
                if (!staleResult.isStale) {
                    // Fresh data, return it
                    return {
                        data: staleResult.data,
                        isFromCache: true,
                        metadata: staleResult.metadata,
                    };
                } else {
                    // Check if data is too old (beyond maxStaleAge)
                    const maxStaleAge = opts.maxStaleAge || 7 * 24 * 60 * 60 * 1000; // 7 days default
                    const age = Date.now() - new Date(staleResult.metadata.createdAt).getTime();

                    if (age <= maxStaleAge) {
                        // Stale but acceptable, return it and revalidate in background
                        // Don't await the revalidation to return stale data immediately
                        callback().then(async (freshResult) => {
                            // Check if fresh data is valid for caching
                            const isDataValid = opts.isDataValidForCache ? opts.isDataValidForCache(freshResult) : true;
                            
                            if (!isDataValid) {
                                // Delete existing cache if fresh data is not valid
                                await provider.deleteCache(cacheKey);
                                return;
                            }

                            // Only cache successful results (no error property)
                            if (!hasErrorProperty(freshResult)) {
                                await provider.writeCache(cacheKey, freshResult);
                            }
                        }).catch(() => {
                            // Ignore revalidation errors, we already have stale data
                        });

                        return {
                            data: staleResult.data,
                            isFromCache: true,
                            metadata: staleResult.metadata,
                        };
                    }
                    // Data is too old, fall through to fresh fetch
                }
            }
        } else {
            // Regular cache lookup without stale-while-revalidate
            const cached = await provider.readCache<T>(cacheKey, opts.ttl);
            if (cached) {
                return {
                    data: cached.data,
                    isFromCache: true,
                    metadata: cached.metadata,
                };
            }
        }

        // Execute the callback to get fresh data
        const result = await callback();

        // Check if data is valid for caching
        const isDataValid = opts.isDataValidForCache ? opts.isDataValidForCache(result) : true;
        
        if (!isDataValid) {
            // Delete existing cache if data is not valid
            await provider.deleteCache(cacheKey);
            return { data: result, isFromCache: false };
        }

        // Only cache successful results (no error property)
        if (!hasErrorProperty(result)) {
            const metadata = await provider.writeCache(cacheKey, result);
            return {
                data: result,
                isFromCache: false,
                metadata,
            };
        }

        return {
            data: result,
            isFromCache: false,
        };
    };

    /**
     * Clears the cache for specific parameters
     * @param params Cache parameters for generating the cache key
     * @returns Whether the cache was successfully cleared
     */
    const clearCache = async (params: CacheParams): Promise<boolean> => {
        const cacheKey = provider.generateCacheKey(params);
        return await provider.deleteCache(cacheKey);
    };

    /**
     * Gets the status of a cache entry
     * @param params Cache parameters for generating the cache key
     * @returns The status of the cache entry
     */
    const getCacheStatus = async (params: CacheParams, ttl?: number): Promise<CacheStatus> => {
        return await provider.getCacheStatus(params, ttl);
    };

    /**
     * Clears all cache entries
     * @returns Whether all cache entries were successfully cleared
     */
    const clearAllCache = async (): Promise<boolean> => {
        return await provider.clearAllCache();
    };

    return {
        withCache,
        clearCache,
        getCacheStatus,
        clearAllCache,
    };
};

export type { CacheOptions, CacheParams, CacheResult, CacheStatus, CacheProvider } from './types'; 