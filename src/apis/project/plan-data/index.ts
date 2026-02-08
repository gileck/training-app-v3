/**
 * Plan Data API
 *
 * ARCHITECTURE NOTE: This API intentionally has NO client.ts file.
 *
 * This is a local-first sync API, not a typical CRUD API:
 * - Client uses Zustand store as source of truth (localStorage)
 * - Sync module (src/client/features/project/plan-data/sync.ts) calls
 *   the API directly via apiClient.post for batch synchronization
 * - No React Query hooks needed - store handles all state
 *
 * @see src/client/features/project/plan-data/sync.ts for client usage
 */

// Domain name
export const name = 'plan-data';

// API endpoint names
export const API_SYNC_PLAN_DATA = 'plan-data/sync';
