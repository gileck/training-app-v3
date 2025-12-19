/**
 * Types for the clear cache API
 */

// No request parameters needed for this endpoint
export type ClearCacheRequest = Record<string, never>;

// Response type for clear cache API
export interface ClearCacheResponse {
  success: boolean;
  message: string;
}
