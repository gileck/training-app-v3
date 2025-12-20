// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_LIST_EXERCISES, API_GET_EXERCISE } from './index';

// Import handlers
import { listExercises } from './handlers/listExercises';
import { getExercise } from './handlers/getExercise';

// Export consolidated handlers object
export const exerciseDefinitionsApiHandlers = {
    [API_LIST_EXERCISES]: { process: listExercises },
    [API_GET_EXERCISE]: { process: getExercise },
};

