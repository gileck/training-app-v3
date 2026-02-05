// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_LIST_EXERCISES,
    API_GET_EXERCISE,
    API_CREATE_EXERCISE,
    API_UPDATE_EXERCISE,
    API_DELETE_EXERCISE,
    API_GET_MUSCLE_GROUPS,
} from './index';

// Import handlers
import { listExercises } from './handlers/listExercises';
import { getExercise } from './handlers/getExercise';
import { createExercise } from './handlers/createExercise';
import { updateExercise } from './handlers/updateExercise';
import { deleteExercise } from './handlers/deleteExercise';
import { getMuscleGroups } from './handlers/getMuscleGroups';

// Export consolidated handlers object
export const exerciseDefinitionsApiHandlers = {
    [API_LIST_EXERCISES]: { process: listExercises },
    [API_GET_EXERCISE]: { process: getExercise },
    [API_CREATE_EXERCISE]: { process: createExercise },
    [API_UPDATE_EXERCISE]: { process: updateExercise },
    [API_DELETE_EXERCISE]: { process: deleteExercise },
    [API_GET_MUSCLE_GROUPS]: { process: getMuscleGroups },
};

