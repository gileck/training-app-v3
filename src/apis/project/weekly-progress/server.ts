// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_GET_WEEK_PROGRESS,
    API_UPDATE_SETS,
    API_GET_EXERCISE_NOTES,
    API_UPDATE_EXERCISE_NOTE,
} from './index';

// Import handlers
import { getWeekProgress } from './handlers/getWeekProgress';
import { updateSets } from './handlers/updateSets';
import { getExerciseNotes } from './handlers/getExerciseNotes';
import { updateExerciseNote } from './handlers/updateExerciseNote';

// Export consolidated handlers object
export const weeklyProgressApiHandlers = {
    [API_GET_WEEK_PROGRESS]: { process: getWeekProgress },
    [API_UPDATE_SETS]: { process: updateSets },
    [API_GET_EXERCISE_NOTES]: { process: getExerciseNotes },
    [API_UPDATE_EXERCISE_NOTE]: { process: updateExerciseNote },
};


