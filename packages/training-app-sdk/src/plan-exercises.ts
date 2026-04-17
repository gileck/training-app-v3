import { callApi, ClientOptions } from './http';
import {
  assertArray,
  assertNonEmptyString,
  assertNonNegativeInteger,
  assertObject,
  assertPositiveNumber,
} from './validation';
import {
  AddPlanExerciseInput,
  BulkAddPlanExercisesInput,
  BulkAddPlanExercisesResponse,
  ListPlanExercisesResponse,
  PlanExerciseResponse,
  ReorderPlanExercisesInput,
  SuccessResponse,
  UpdatePlanExerciseInput,
} from './types';

/**
 * Exercises assigned to a plan. These are distinct from {@link ExerciseDefinition}s —
 * a plan exercise is one instance (with target sets/reps/weight) referencing
 * a definition from the library.
 */
export function planExercisesDomain(opts: ClientOptions) {
  return {
    /** List all plan exercises for a plan, with their resolved exercise definitions. */
    list: (planId: string): Promise<ListPlanExercisesResponse> => {
      assertNonEmptyString(planId, 'planId');
      return callApi(opts, 'plan-exercises/list', { planId });
    },

    /** Add a single exercise to a plan. */
    add: (input: AddPlanExerciseInput): Promise<PlanExerciseResponse> => {
      validatePlanExerciseInput(input, 'input');
      return callApi(opts, 'plan-exercises/add', input);
    },

    /**
     * Add many exercises to a plan in one call. Partial success is possible —
     * inspect `results[i].error` per item.
     */
    bulkAdd: (input: BulkAddPlanExercisesInput): Promise<BulkAddPlanExercisesResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planId, 'input.planId');
      assertArray(input.exercises, 'input.exercises', 1);
      input.exercises.forEach((ex, i) => {
        assertObject(ex, `input.exercises[${i}]`);
        assertNonEmptyString(ex.exerciseDefId, `input.exercises[${i}].exerciseDefId`);
        assertPositiveNumber(ex.sets, `input.exercises[${i}].sets`);
        assertNonNegativeInteger(ex.reps, `input.exercises[${i}].reps`);
      });
      return callApi(opts, 'plan-exercises/bulk-add', input);
    },

    /** Update an existing plan exercise. Only pass the fields you want to change. */
    update: (input: UpdatePlanExerciseInput): Promise<PlanExerciseResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planExerciseId, 'input.planExerciseId');
      if (input.sets !== undefined) assertPositiveNumber(input.sets, 'input.sets');
      if (input.reps !== undefined) assertNonNegativeInteger(input.reps, 'input.reps');
      return callApi(opts, 'plan-exercises/update', input);
    },

    /** Delete a plan exercise. Related weekly progress and workout entries are cleaned up server-side. */
    delete: (planExerciseId: string): Promise<SuccessResponse> => {
      assertNonEmptyString(planExerciseId, 'planExerciseId');
      return callApi(opts, 'plan-exercises/delete', { planExerciseId });
    },

    /** Reorder plan exercises. `exerciseIds` must list every plan exercise for the plan exactly once. */
    reorder: (input: ReorderPlanExercisesInput): Promise<SuccessResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planId, 'input.planId');
      assertArray(input.exerciseIds, 'input.exerciseIds', 1);
      input.exerciseIds.forEach((id, i) => assertNonEmptyString(id, `input.exerciseIds[${i}]`));
      return callApi(opts, 'plan-exercises/reorder', input);
    },
  };
}

function validatePlanExerciseInput(input: AddPlanExerciseInput, field: string) {
  assertObject(input, field);
  assertNonEmptyString(input.planId, `${field}.planId`);
  assertNonEmptyString(input.exerciseDefId, `${field}.exerciseDefId`);
  assertPositiveNumber(input.sets, `${field}.sets`);
  assertNonNegativeInteger(input.reps, `${field}.reps`);
}
