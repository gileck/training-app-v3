// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_LIST_SAVED_WORKOUTS,
    API_GET_SAVED_WORKOUT,
    API_CREATE_SAVED_WORKOUT,
    API_UPDATE_SAVED_WORKOUT,
    API_DELETE_SAVED_WORKOUT,
    API_REORDER_SAVED_WORKOUTS,
} from './index';

// Import handlers
import { listSavedWorkouts } from './handlers/listSavedWorkouts';
import { getSavedWorkout } from './handlers/getSavedWorkout';
import { createSavedWorkout } from './handlers/createSavedWorkout';
import { updateSavedWorkout } from './handlers/updateSavedWorkout';
import { deleteSavedWorkout } from './handlers/deleteSavedWorkout';
import { reorderSavedWorkouts } from './handlers/reorderSavedWorkouts';

// Export consolidated handlers object
export const savedWorkoutsApiHandlers = {
    [API_LIST_SAVED_WORKOUTS]: { process: listSavedWorkouts },
    [API_GET_SAVED_WORKOUT]: { process: getSavedWorkout },
    [API_CREATE_SAVED_WORKOUT]: { process: createSavedWorkout },
    [API_UPDATE_SAVED_WORKOUT]: { process: updateSavedWorkout },
    [API_DELETE_SAVED_WORKOUT]: { process: deleteSavedWorkout },
    [API_REORDER_SAVED_WORKOUTS]: { process: reorderSavedWorkouts },
};

