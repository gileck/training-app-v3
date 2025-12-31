// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_LIST_PLAN_WORKOUTS,
    API_CREATE_PLAN_WORKOUT,
    API_UPDATE_PLAN_WORKOUT,
    API_DELETE_PLAN_WORKOUT,
    API_REORDER_PLAN_WORKOUTS,
} from './index';

// Import handlers
import { listPlanWorkouts } from './handlers/listPlanWorkouts';
import { createPlanWorkout } from './handlers/createPlanWorkout';
import { updatePlanWorkout } from './handlers/updatePlanWorkout';
import { deletePlanWorkout } from './handlers/deletePlanWorkout';
import { reorderPlanWorkouts } from './handlers/reorderPlanWorkouts';

// Export consolidated handlers object
export const planWorkoutsApiHandlers = {
    [API_LIST_PLAN_WORKOUTS]: { process: listPlanWorkouts },
    [API_CREATE_PLAN_WORKOUT]: { process: createPlanWorkout },
    [API_UPDATE_PLAN_WORKOUT]: { process: updatePlanWorkout },
    [API_DELETE_PLAN_WORKOUT]: { process: deletePlanWorkout },
    [API_REORDER_PLAN_WORKOUTS]: { process: reorderPlanWorkouts },
};
