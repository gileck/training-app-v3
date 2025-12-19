import apiClient from '@/client/utils/apiClient';
import { name } from './index';
import { ClearCacheRequest, ClearCacheResponse } from './types';
import { CacheResult } from '@/common/cache/types';

/**
 * Send request to clear the cache
 * @param request The clear cache request parameters
 * @returns Promise with the clear cache response
 */
export const clearCache = (request: ClearCacheRequest): Promise<CacheResult<ClearCacheResponse>> => {
  return apiClient.call<ClearCacheResponse, ClearCacheRequest>(name, request);
};
