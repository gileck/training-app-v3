/**
 * @training-app/sdk — programmatic access to the training app.
 *
 * Call `createClient({ baseUrl, adminToken, userId })` and then use the typed
 * domain methods (`client.plans.list()`, …) or the escape hatch
 * `client.call<T>(apiName, params)` for APIs that don't have a wrapper yet.
 *
 * Errors throw subclasses of {@link TrainingAppError}. See `./errors.ts`.
 */

import { callApi, ClientOptions } from './http';
import { activityLogsDomain } from './activity-logs';
import { exerciseDefinitionsDomain } from './exercise-definitions';
import { planExercisesDomain } from './plan-exercises';
import { planWorkoutsDomain } from './plan-workouts';
import { plansDomain } from './plans';
import { weeklyProgressDomain } from './weekly-progress';
import { assertNonEmptyString } from './validation';

// Errors
export {
  TrainingAppError,
  TrainingAppApiError,
  TrainingAppNetworkError,
  TrainingAppResponseError,
  TrainingAppValidationError,
} from './errors';
export type { ServerErrorCode } from './errors';

// HTTP / core
export type { ClientOptions, CacheResult } from './http';
export { callApi } from './http';

// Types
export * from './types';

/**
 * Create a typed client. Validates required options upfront — throws
 * {@link TrainingAppValidationError} if `baseUrl`, `adminToken`, or `userId`
 * is missing.
 *
 * @example
 * ```ts
 * import { createClient } from '@training-app/sdk';
 *
 * const client = createClient({
 *   baseUrl: 'https://training.example.com',
 *   adminToken: process.env.TRAINING_APP_TOKEN!,
 *   userId: '65f0...e1',
 * });
 *
 * const { plans } = await client.plans.list();
 * ```
 */
export function createClient(opts: ClientOptions) {
  assertNonEmptyString(opts.baseUrl, 'opts.baseUrl');
  assertNonEmptyString(opts.adminToken, 'opts.adminToken');
  assertNonEmptyString(opts.userId, 'opts.userId');

  return {
    plans: plansDomain(opts),
    exerciseDefinitions: exerciseDefinitionsDomain(opts),
    planExercises: planExercisesDomain(opts),
    planWorkouts: planWorkoutsDomain(opts),
    weeklyProgress: weeklyProgressDomain(opts),
    activityLogs: activityLogsDomain(opts),

    /**
     * Escape hatch for APIs that don't have a typed wrapper yet.
     *
     * @param apiName slash-delimited name from `src/apis/**\/index.ts`,
     *   e.g. `"plan-data/get"`.
     * @param params request params; forwarded as `{ params }` in the body.
     *
     * @example
     * ```ts
     * const resp = await client.call<{ data: unknown }>('plan-data/get', { planId });
     * ```
     */
    call: <T = unknown>(apiName: string, params?: unknown): Promise<T> =>
      callApi<T>(opts, apiName, params),
  };
}

/** The object returned by {@link createClient}. */
export type TrainingAppClient = ReturnType<typeof createClient>;
