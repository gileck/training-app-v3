// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_GET_WEEK_PROGRESS,
    API_UPDATE_SETS,
    API_GET_WEEKLY_NOTE,
    API_UPDATE_WEEKLY_NOTE,
} from './index';

// Import handlers
import { getWeekProgress } from './handlers/getWeekProgress';
import { updateSets } from './handlers/updateSets';
import { getWeeklyNote } from './handlers/getWeeklyNote';
import { updateWeeklyNote } from './handlers/updateWeeklyNote';

// Export consolidated handlers object
export const weeklyProgressApiHandlers = {
    [API_GET_WEEK_PROGRESS]: { process: getWeekProgress },
    [API_UPDATE_SETS]: { process: updateSets },
    [API_GET_WEEKLY_NOTE]: { process: getWeeklyNote },
    [API_UPDATE_WEEKLY_NOTE]: { process: updateWeeklyNote },
};


