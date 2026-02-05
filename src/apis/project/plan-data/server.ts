// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_SYNC_PLAN_DATA } from './index';

// Import handlers
import { syncPlanData } from './handlers/syncPlanData';

// Export consolidated handlers object
export const planDataApiHandlers = {
    [API_SYNC_PLAN_DATA]: { process: syncPlanData },
};
