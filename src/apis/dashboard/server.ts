// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_GET_DASHBOARD_ANALYTICS } from './index';

// Import handlers
import { getAnalytics } from './handlers/getAnalytics';

// Export consolidated handlers object
export const dashboardApiHandlers = {
    [API_GET_DASHBOARD_ANALYTICS]: { process: getAnalytics },
};
