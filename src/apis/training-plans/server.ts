// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_LIST_PLANS,
    API_GET_PLAN,
    API_CREATE_PLAN,
    API_DELETE_PLAN,
    API_SET_ACTIVE_PLAN,
} from './index';

// Import handlers
import { listPlans } from './handlers/listPlans';
import { getPlan } from './handlers/getPlan';
import { createPlan } from './handlers/createPlan';
import { deletePlan } from './handlers/deletePlan';
import { setActivePlan } from './handlers/setActivePlan';

// Export consolidated handlers object
export const trainingPlansApiHandlers = {
    [API_LIST_PLANS]: { process: listPlans },
    [API_GET_PLAN]: { process: getPlan },
    [API_CREATE_PLAN]: { process: createPlan },
    [API_DELETE_PLAN]: { process: deletePlan },
    [API_SET_ACTIVE_PLAN]: { process: setActivePlan },
};


