import * as fsCache from './fsCache';
import * as s3Cache from './s3Cache';
import { CacheProvider } from '@/common/cache/types';

/**
 * File System Cache Provider
 */
export const fsCacheProvider: CacheProvider = {
    generateCacheKey: fsCache.generateCacheKey,
    readCache: fsCache.readCache,
    readCacheWithStale: fsCache.readCacheWithStale,
    writeCache: fsCache.writeCache,
    deleteCache: fsCache.deleteCache,
    clearAllCache: fsCache.clearAllCache,
    getCacheStatus: fsCache.getCacheStatus,
};

/**
 * S3 Cache Provider
 */
export const s3CacheProvider: CacheProvider = {
    generateCacheKey: s3Cache.generateCacheKey,
    readCache: s3Cache.readCache,
    readCacheWithStale: s3Cache.readCacheWithStale,
    writeCache: s3Cache.writeCache,
    deleteCache: s3Cache.deleteCache,
    clearAllCache: s3Cache.clearAllCache,
    getCacheStatus: s3Cache.getCacheStatus,
}; 