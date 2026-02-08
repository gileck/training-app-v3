/**
 * Workout Warmup API
 *
 * ARCHITECTURE NOTE: This API has NO handlers/ folder - handlers are
 * inlined in server.ts.
 *
 * This is acceptable for single-operation APIs:
 * - Only one endpoint: generateWarmup
 * - All logic contained in ~100 lines
 * - No need for separate handler files
 *
 * For multi-operation APIs, use the handlers/ folder pattern instead.
 */

export type * from './types';
export const name = 'workout-warmup';
export const GENERATE_WARMUP = 'workout-warmup/generate';
