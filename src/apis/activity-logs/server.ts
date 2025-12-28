// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_GET_ACTIVITY,
    API_GET_ACTIVITY_SUMMARY,
    API_GET_EXERCISE_HISTORY,
    API_DELETE_ACTIVITY,
    API_BULK_DELETE_ACTIVITY,
    API_EDIT_ACTIVITY,
    API_DUPLICATE_ACTIVITY,
} from './index';

// Import handlers
import { getActivity } from './handlers/getActivity';
import { getActivitySummary } from './handlers/getActivitySummary';
import { getExerciseHistory } from './handlers/getExerciseHistory';
import { deleteActivity } from './handlers/deleteActivity';
import { bulkDeleteActivity } from './handlers/bulkDeleteActivity';
import { editActivity } from './handlers/editActivity';
import { duplicateActivity } from './handlers/duplicateActivity';

// Export consolidated handlers object
export const activityLogsApiHandlers = {
    [API_GET_ACTIVITY]: { process: getActivity },
    [API_GET_ACTIVITY_SUMMARY]: { process: getActivitySummary },
    [API_GET_EXERCISE_HISTORY]: { process: getExerciseHistory },
    [API_DELETE_ACTIVITY]: { process: deleteActivity },
    [API_BULK_DELETE_ACTIVITY]: { process: bulkDeleteActivity },
    [API_EDIT_ACTIVITY]: { process: editActivity },
    [API_DUPLICATE_ACTIVITY]: { process: duplicateActivity },
};
