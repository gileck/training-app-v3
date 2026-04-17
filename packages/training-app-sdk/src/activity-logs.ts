import { callApi, ClientOptions } from './http';
import { assertArray, assertNonEmptyString, assertObject } from './validation';
import {
  ActivityResponse,
  ActivitySummaryResponse,
  AddActivityInput,
  EditActivityInput,
  ExerciseHistoryResponse,
  GetActivityInput,
  GetActivityResponse,
  SuccessResponse,
} from './types';

/**
 * Activity logs — every completed set/rep event across all plans. Use these
 * for history views, progress analytics, and editing historical entries.
 */
export function activityLogsDomain(opts: ClientOptions) {
  return {
    /** Fetch activity log entries, optionally narrowed by plan and/or date range. */
    get: (input: GetActivityInput = {}): Promise<GetActivityResponse> => {
      assertObject(input, 'input');
      return callApi(opts, 'activity-logs/get-activity', input);
    },

    /** Aggregated summary (total sets, reps, volume, per-exercise breakdown). */
    summary: (input: GetActivityInput = {}): Promise<ActivitySummaryResponse> => {
      assertObject(input, 'input');
      return callApi(opts, 'activity-logs/get-summary', input);
    },

    /** Historical log for a specific plan exercise. */
    exerciseHistory: (planExerciseId: string): Promise<ExerciseHistoryResponse> => {
      assertNonEmptyString(planExerciseId, 'planExerciseId');
      return callApi(opts, 'activity-logs/get-exercise-history', { planExerciseId });
    },

    /** Record a new activity event. */
    add: (input: AddActivityInput): Promise<ActivityResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planId, 'input.planId');
      assertNonEmptyString(input.planExerciseId, 'input.planExerciseId');
      return callApi(opts, 'activity-logs/add-activity', input);
    },

    /** Edit an existing activity entry. Only pass the fields you want to change. */
    edit: (input: EditActivityInput): Promise<ActivityResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.activityId, 'input.activityId');
      return callApi(opts, 'activity-logs/edit-activity', input);
    },

    /** Delete a single activity entry. */
    delete: (activityId: string): Promise<SuccessResponse> => {
      assertNonEmptyString(activityId, 'activityId');
      return callApi(opts, 'activity-logs/delete-activity', { activityId });
    },

    /** Delete many activity entries in one call. */
    bulkDelete: (activityIds: string[]): Promise<SuccessResponse> => {
      assertArray(activityIds, 'activityIds', 1);
      activityIds.forEach((id, i) => assertNonEmptyString(id, `activityIds[${i}]`));
      return callApi(opts, 'activity-logs/bulk-delete-activity', { activityIds });
    },

    /** Duplicate an existing activity entry (useful for repeating similar sets). */
    duplicate: (activityId: string): Promise<ActivityResponse> => {
      assertNonEmptyString(activityId, 'activityId');
      return callApi(opts, 'activity-logs/duplicate-activity', { activityId });
    },
  };
}
