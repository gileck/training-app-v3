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
import { listPlanExercises, apiMeta as listPlanExercisesMeta } from './handlers/listPlanExercises';
import { addPlanExercise, apiMeta as addPlanExerciseMeta } from './handlers/addPlanExercise';
import { bulkAddPlanExercises } from './handlers/bulkAddPlanExercises';
import { updatePlanExercise, apiMeta as updatePlanExerciseMeta } from './handlers/updatePlanExercise';
import { deletePlanExercise, apiMeta as deletePlanExerciseMeta } from './handlers/deletePlanExercise';
import { reorderPlanExercises } from './handlers/reorderPlanExercises';
import { uploadOverrideImage } from './handlers/uploadOverrideImage';

// Export consolidated handlers object
export const planExercisesApiHandlers = {
    [API_LIST_PLAN_EXERCISES]: { process: listPlanExercises, meta: listPlanExercisesMeta },
    [API_ADD_PLAN_EXERCISE]: { process: addPlanExercise, meta: addPlanExerciseMeta },
    [API_BULK_ADD_PLAN_EXERCISES]: { process: bulkAddPlanExercises },
    [API_UPDATE_PLAN_EXERCISE]: { process: updatePlanExercise, meta: updatePlanExerciseMeta },
    [API_DELETE_PLAN_EXERCISE]: { process: deletePlanExercise, meta: deletePlanExerciseMeta },
    [API_REORDER_PLAN_EXERCISES]: { process: reorderPlanExercises },
    [API_UPLOAD_OVERRIDE_IMAGE]: { process: uploadOverrideImage },
};

