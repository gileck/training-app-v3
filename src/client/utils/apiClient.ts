import { CacheResult } from "@/common/cache/types";
import type { Settings } from "@/client/features/settings";
import { useSettingsStore } from "@/client/features/settings";
import {
  enqueueOfflinePost,
  generateQueueId,
  flushOfflineQueue,
  shouldFlushNow,
} from '@/client/utils/offlinePostQueue';
import { logger } from '@/client/features/session-logs';

// Legacy callback support for initialization
let getSettingsRef: (() => Settings) | null = null;

export function initializeApiClient(getSettings: () => Settings) {
  getSettingsRef = getSettings;
  // Try to flush queued POST requests when settings change (e.g., leaving offline mode)
  try {
    const settings = getSettingsRef?.();
    if (shouldFlushNow(settings)) {
      void flushOfflineQueue(() => getSettingsRef?.());
    }
  } catch {
    // ignore
  }
}

/**
 * Get settings from Zustand store (preferred) or fallback to callback
 */
function getSettingsSafe(): Settings | null {
  // Try to get from Zustand store first (preferred)
  try {
    return useSettingsStore.getState().settings;
  } catch {
    // Fallback to legacy callback
    try {
      return getSettingsRef ? getSettingsRef() : null;
    } catch {
      return null;
    }
  }
}

export const apiClient = {
  /**
   * Make a GET-style request to an API endpoint (for queries).
   * 
   * Caching is handled by React Query - this method just does the fetch.
   * When offline, returns an error result (React Query will use its cached data).
   * 
   * @param name The API endpoint name
   * @param params Request parameters
   * @returns Promise with the typed response
   */
  call: async <ResponseType, Params = Record<string, string | number | boolean | undefined | null>>(
    name: string,
    params?: Params
  ): Promise<CacheResult<ResponseType>> => {
    const startTime = Date.now();
    const settings = getSettingsSafe();

    // Log the API request
    logger.apiRequest(name, params);

    const effectiveOffline = (settings?.offlineMode === true) || (typeof navigator !== 'undefined' && !navigator.onLine);

    // Handle offline mode - let React Query handle cached data
    if (effectiveOffline) {
      const errorResult = {
        data: { error: 'Network unavailable while offline' } as ResponseType,
        isFromCache: false
      };
      logger.apiResponse(name, errorResult.data, { 
        duration: Date.now() - startTime, 
        error: 'Network unavailable while offline' 
      });
      return errorResult;
    }

    const doFetch = async (): Promise<ResponseType> => {
      // Convert slashes to underscores for URL
      const urlName = name.replace(/\//g, '_');
      
      const response = await fetch(`/api/process/${urlName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ params }),
      });

      if (response.status !== 200) {
        throw new Error(`Failed to call ${name}: HTTP ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result?.data && typeof result.data === 'object' && 'error' in result.data && result.data.error != null) {
        throw new Error(`Failed to call ${name}: ${result.data.error}`);
      }

      return result.data;
    };

    // Try network request with retries
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const data = await doFetch();
        
        logger.apiResponse(name, data, { 
          duration: Date.now() - startTime, 
          cached: false 
        });
        return { data, isFromCache: false };
      } catch (error) {
        // Only retry on network errors (TypeError from fetch)
        if (!(error instanceof TypeError)) {
          logger.apiResponse(name, undefined, { 
            duration: Date.now() - startTime, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          throw error;
        }
        // Don't wait on last attempt
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // 500ms, 1s, 1.5s
        }
      }
    }

    // All retries failed
    const errorResult = {
      data: { error: 'Network request failed after retries' } as ResponseType,
      isFromCache: false
    };
    logger.apiResponse(name, errorResult.data, { 
      duration: Date.now() - startTime, 
      error: 'Network request failed after retries' 
    });
    return errorResult;
  },

  /**
   * Direct POST for mutations (create, update, delete).
   * 
   * ⚠️ IMPORTANT: OFFLINE MODE BEHAVIOR
   * 
   * When offline, this method returns `{ data: {}, isFromCache: false }`.
   * The request is queued for batch sync when the device comes back online.
   * 
   * CALLERS MUST NEVER ASSUME `data` contains actual response properties.
   * Always guard against empty/undefined data in mutation callbacks:
   * 
   * @example
   * ```typescript
   * useMutation({
   *   mutationFn: async (data) => {
   *     const response = await apiClient.post<ResponseType>('entity/update', data);
   *     return response.data;
   *   },
   *   onSuccess: (data) => {
   *     // ✅ CORRECT: Guard against empty data from offline mode
   *     if (data && data.entity) {
   *       queryClient.setQueryData(['entity', data.entity.id], data);
   *     }
   *     
   *     // ❌ WRONG: Will crash when offline (data.entity is undefined)
   *     queryClient.setQueryData(['entity', data.entity.id], data);
   *   },
   * });
   * ```
   * 
   * The optimistic update pattern handles the UI immediately via `onMutate`.
   * The empty `{}` return ensures no error is thrown and no rollback occurs.
   * The actual sync happens later via batch-updates when online.
   */
  post: async <ResponseType, Params = Record<string, string | number | boolean | undefined | null>>(
    name: string,
    params?: Params
  ): Promise<CacheResult<ResponseType>> => {
    const startTime = Date.now();
    const settings = getSettingsSafe();
    const effectiveOffline = (settings?.offlineMode === true) || (typeof navigator !== 'undefined' && !navigator.onLine);

    // Log the API request
    logger.apiRequest(name, params);

    if (effectiveOffline) {
      // Queue for later sync when back online
      enqueueOfflinePost<Params>({
        id: generateQueueId(),
        name,
        params,
        enqueuedAt: Date.now(),
      });

      // Log queued for offline
      logger.apiResponse(name, {}, { 
        duration: Date.now() - startTime, 
        cached: false 
      });

      // Return empty object - NOT an error.
      // Callers MUST handle this case (see JSDoc above).
      // Optimistic updates handle the UI; this just prevents rollback.
      return { data: {} as ResponseType, isFromCache: false };
    }

    // Convert slashes to underscores for URL
    const urlName = name.replace(/\//g, '_');
    
    try {
      const response = await fetch(`/api/process/${urlName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ params }),
      });

      if (response.status !== 200) {
        const error = `Failed to call ${name}: HTTP ${response.status} ${response.statusText}`;
        logger.apiResponse(name, undefined, { 
          duration: Date.now() - startTime, 
          error 
        });
        throw new Error(error);
      }

      const result = await response.json();

      if (result?.data && typeof result.data === 'object' && 'error' in result.data && result.data.error != null) {
        const error = `Failed to call ${name}: ${result.data.error}`;
        logger.apiResponse(name, result.data, { 
          duration: Date.now() - startTime, 
          error 
        });
        throw new Error(error);
      }

      logger.apiResponse(name, result.data, { 
        duration: Date.now() - startTime, 
        cached: false 
      });

      return { data: result.data as ResponseType, isFromCache: false };
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith('Failed to call'))) {
        // Log unexpected errors that weren't already logged
        logger.apiResponse(name, undefined, { 
          duration: Date.now() - startTime, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
      throw error;
    }
  }
};

export default apiClient;
