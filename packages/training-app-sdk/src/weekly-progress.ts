import { callApi, ClientOptions } from './http';
import { TrainingAppValidationError } from './errors';
import {
  assertNonEmptyString,
  assertNonNegativeInteger,
  assertObject,
  assertOneOf,
  assertPositiveNumber,
} from './validation';
import {
  GetExerciseNoteResponse,
  GetWeekProgressInput,
  GetWeekProgressResponse,
  SuccessResponse,
  UpdateExerciseNoteInput,
  UpdateSetsInput,
  UpdateSetsResponse,
  UPDATE_SETS_ACTIONS,
} from './types';

/**
 * Weekly progress — per-week set-completion tracking for each plan exercise,
 * plus optional per-week notes.
 */
export function weeklyProgressDomain(opts: ClientOptions) {
  return {
    /** Get completion state for all plan exercises in a given week. */
    getWeek: (input: GetWeekProgressInput): Promise<GetWeekProgressResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planId, 'input.planId');
      assertPositiveNumber(input.weekNumber, 'input.weekNumber');
      return callApi(opts, 'weekly-progress/get-week', input);
    },

    /**
     * Increment, decrement, or complete-all the logged sets for one plan exercise in one week.
     * Pass `targetSets` when `action === 'complete-all'` so the server knows how
     * many sets the exercise actually has.
     */
    updateSets: (input: UpdateSetsInput): Promise<UpdateSetsResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planId, 'input.planId');
      assertNonEmptyString(input.planExerciseId, 'input.planExerciseId');
      assertPositiveNumber(input.weekNumber, 'input.weekNumber');
      assertOneOf(input.action, UPDATE_SETS_ACTIONS, 'input.action');
      if (input.action === 'complete-all') {
        if (input.targetSets === undefined) {
          // allow server to reject, but nudge caller early
          assertPositiveNumber(input.targetSets, 'input.targetSets');
        } else {
          assertNonNegativeInteger(input.targetSets, 'input.targetSets');
        }
      }
      return callApi(opts, 'weekly-progress/update-sets', input);
    },

    /** Read the free-form note attached to a (plan exercise, week) pair. */
    getExerciseNotes: (
      planId: string,
      planExerciseId: string,
      weekNumber: number,
    ): Promise<GetExerciseNoteResponse> => {
      assertNonEmptyString(planId, 'planId');
      assertNonEmptyString(planExerciseId, 'planExerciseId');
      assertPositiveNumber(weekNumber, 'weekNumber');
      return callApi(opts, 'weekly-progress/get-exercise-notes', {
        planId,
        planExerciseId,
        weekNumber,
      });
    },

    /** Upsert the free-form note for a (plan exercise, week) pair. Empty string clears it. */
    updateExerciseNote: (input: UpdateExerciseNoteInput): Promise<SuccessResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planId, 'input.planId');
      assertNonEmptyString(input.planExerciseId, 'input.planExerciseId');
      assertPositiveNumber(input.weekNumber, 'input.weekNumber');
      if (typeof input.note !== 'string') {
        throw new TrainingAppValidationError(
          'input.note',
          'must be a string (empty string clears the note)',
        );
      }
      return callApi(opts, 'weekly-progress/update-exercise-note', input);
    },
  };
}
