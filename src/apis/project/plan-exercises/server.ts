// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_LIST_PLAN_EXERCISES,
    API_ADD_PLAN_EXERCISE,
    API_BULK_ADD_PLAN_EXERCISES,
    API_UPDATE_PLAN_EXERCISE,
    API_DELETE_PLAN_EXERCISE,
    API_REORDER_PLAN_EXERCISES,
    API_UPLOAD_OVERRIDE_IMAGE,
} from './index';

// Import handlers
import { listPlanExercises } from './handlers/listPlanExercises';
import { addPlanExercise } from './handlers/addPlanExercise';
import { bulkAddPlanExercises } from './handlers/bulkAddPlanExercises';
import { updatePlanExercise } from './handlers/updatePlanExercise';
import { deletePlanExercise } from './handlers/deletePlanExercise';
import { reorderPlanExercises } from './handlers/reorderPlanExercises';
import { uploadOverrideImage } from './handlers/uploadOverrideImage';

// Export consolidated handlers object
export const planExercisesApiHandlers = {
    [API_LIST_PLAN_EXERCISES]: { process: listPlanExercises },
    [API_ADD_PLAN_EXERCISE]: { process: addPlanExercise },
    [API_BULK_ADD_PLAN_EXERCISES]: { process: bulkAddPlanExercises },
    [API_UPDATE_PLAN_EXERCISE]: { process: updatePlanExercise },
    [API_DELETE_PLAN_EXERCISE]: { process: deletePlanExercise },
    [API_REORDER_PLAN_EXERCISES]: { process: reorderPlanExercises },
    [API_UPLOAD_OVERRIDE_IMAGE]: { process: uploadOverrideImage },
};

