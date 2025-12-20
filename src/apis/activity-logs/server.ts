// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_GET_ACTIVITY, API_GET_ACTIVITY_SUMMARY } from './index';

// Import handlers
import { getActivity } from './handlers/getActivity';
import { getActivitySummary } from './handlers/getActivitySummary';

// Export consolidated handlers object
export const activityLogsApiHandlers = {
    [API_GET_ACTIVITY]: { process: getActivity },
    [API_GET_ACTIVITY_SUMMARY]: { process: getActivitySummary },
};
