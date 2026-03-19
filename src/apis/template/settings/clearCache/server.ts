import { createCache } from '@/common/cache';
import { ClearCacheResponse } from './types';
import { name } from "./index";
import { fsCacheProvider, s3CacheProvider } from '@/server/template/cache/providers';
import { appConfig } from '@/app.config';

export * from "./index";

// Helper to get cache instance
const getServerCache = () => {
  const provider = appConfig.cacheType === 's3' ? s3CacheProvider : fsCacheProvider;
  return createCache(provider);
};

/**
 * Clear all cache entries
 * This function contains the core business logic for the clear cache API
 */
export const process = async (): Promise<ClearCacheResponse> => {
  try {
    const serverCache = getServerCache();
    const success = await serverCache.clearAllCache();

    return {
      success,
      message: success ? 'Cache cleared successfully' : 'Failed to clear cache'
    };
  } catch (error) {
    console.error('Error clearing cache:', error);

    return {
      success: false,
      message: `Error clearing cache: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const clearCacheApiHandlers = {
  [name]: { process },
};
