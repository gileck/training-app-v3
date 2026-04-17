import { callApi, ClientOptions } from './http';
import {
  assertNonEmptyString,
  assertObject,
  assertPositiveNumber,
} from './validation';
import {
  CreatePlanInput,
  ListPlansResponse,
  PlanResponse,
  SuccessResponse,
  UpdatePlanInput,
} from './types';

/**
 * Training-plans domain methods. Each plan is owned by the calling user
 * (determined by the `X-On-Behalf-Of` header).
 */
export function plansDomain(opts: ClientOptions) {
  return {
    /** List every plan belonging to the calling user. */
    list: (): Promise<ListPlansResponse> => callApi(opts, 'training-plans/list'),

    /** Fetch a single plan by id. Throws `PLAN_NOT_FOUND` if missing or owned by another user. */
    get: (planId: string): Promise<PlanResponse> => {
      assertNonEmptyString(planId, 'planId');
      return callApi(opts, 'training-plans/get', { planId });
    },

    /** Create a new plan. `durationWeeks` must be a positive integer. */
    create: (input: CreatePlanInput): Promise<PlanResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.name, 'input.name');
      assertPositiveNumber(input.durationWeeks, 'input.durationWeeks');
      return callApi(opts, 'training-plans/create', input);
    },

    /** Update a plan. Only pass the fields you want to change. */
    update: (input: UpdatePlanInput): Promise<PlanResponse> => {
      assertObject(input, 'input');
      assertNonEmptyString(input.planId, 'input.planId');
      if (input.durationWeeks !== undefined) {
        assertPositiveNumber(input.durationWeeks, 'input.durationWeeks');
      }
      return callApi(opts, 'training-plans/update', input);
    },

    /** Permanently delete a plan and all of its exercises/workouts/progress. */
    delete: (planId: string): Promise<SuccessResponse> => {
      assertNonEmptyString(planId, 'planId');
      return callApi(opts, 'training-plans/delete', { planId });
    },

    /** Mark a plan as the user's active plan (the one shown by default). */
    setActive: (planId: string): Promise<PlanResponse> => {
      assertNonEmptyString(planId, 'planId');
      return callApi(opts, 'training-plans/set-active', { planId });
    },

    /** Duplicate a plan, including its exercises and workouts. Returns the new plan. */
    duplicate: (planId: string): Promise<PlanResponse> => {
      assertNonEmptyString(planId, 'planId');
      return callApi(opts, 'training-plans/duplicate', { planId });
    },
  };
}
