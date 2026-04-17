import { callApi, ClientOptions } from './http';
import {
  assertArray,
  assertNonEmptyString,
  assertNonNegativeInteger,
  assertObject,
} from './validation';
import {
  CreatePlanWorkoutInput,
  ListPlanWorkoutsResponse,
  PlanWorkoutItem,
  PlanWorkoutResponse,
  SuccessResponse,
  UpdatePlanWorkoutInput,
} from './types';

/**
 * Plan workouts — named groupings of plan exercises (e.g. "Push Day", "Leg Day").
 * A workout's `items` reference plan-exercise ids, not definition ids.
 */
export function planWorkoutsDomain(opts: ClientOptions) {
  return {
    /** List all workouts defined for a plan. */
    list: (planId: string): Promise<ListPlanWorkoutsResponse> => {
      assertNonEmptyString(planId, 'planId');
      return callApi(opts, 'plan-workouts/list', { planId });
    },

    /** Create a workout. `items` must reference plan exercises that exist on `planId`. */
    create: (input: CreatePlanWorkoutInput): Promise<PlanWorkoutResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planId, 'input.planId');
      assertNonEmptyString(input.name, 'input.name');
      assertArray(input.items, 'input.items');
      input.items.forEach((item, i) => validateWorkoutItem(item, `input.items[${i}]`));
      return callApi(opts, 'plan-workouts/create', input);
    },

    /** Update a workout. Only pass the fields you want to change. */
    update: (input: UpdatePlanWorkoutInput): Promise<PlanWorkoutResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planId, 'input.planId');
      assertNonEmptyString(input.workoutId, 'input.workoutId');
      if (input.items !== undefined) {
        assertArray(input.items, 'input.items');
        input.items.forEach((item, i) => validateWorkoutItem(item, `input.items[${i}]`));
      }
      return callApi(opts, 'plan-workouts/update', input);
    },

    /** Delete a workout. Plan exercises themselves are not deleted. */
    delete: (planId: string, workoutId: string): Promise<SuccessResponse> => {
      assertNonEmptyString(planId, 'planId');
      assertNonEmptyString(workoutId, 'workoutId');
      return callApi(opts, 'plan-workouts/delete', { planId, workoutId });
    },

    /** Reorder workouts within a plan. */
    reorder: (planId: string, workoutIds: string[]): Promise<SuccessResponse> => {
      assertNonEmptyString(planId, 'planId');
      assertArray(workoutIds, 'workoutIds', 1);
      workoutIds.forEach((id, i) => assertNonEmptyString(id, `workoutIds[${i}]`));
      return callApi(opts, 'plan-workouts/reorder', { planId, workoutIds });
    },
  };
}

function validateWorkoutItem(item: PlanWorkoutItem, field: string) {
  assertObject(item, field);
  assertNonEmptyString(item.planExerciseId, `${field}.planExerciseId`);
  assertNonNegativeInteger(item.order, `${field}.order`);
}
