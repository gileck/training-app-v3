// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_LIST_PLANS,
    API_GET_PLAN,
    API_CREATE_PLAN,
    API_UPDATE_PLAN,
    API_DELETE_PLAN,
    API_SET_ACTIVE_PLAN,
    API_DUPLICATE_PLAN,
    API_GENERATE_PLAN_FROM_TEXT,
    API_CREATE_PLAN_FROM_TEXT,
    API_EXPORT_PLAN,
    API_MATCH_IMPORTED_PLAN,
    API_GET_SHARED_PLAN,
} from './index';

// Import handlers
import { listPlans, apiMeta as listPlansMeta } from './handlers/listPlans';
import { getPlan, apiMeta as getPlanMeta } from './handlers/getPlan';
import { createPlan, apiMeta as createPlanMeta } from './handlers/createPlan';
import { updatePlan, apiMeta as updatePlanMeta } from './handlers/updatePlan';
import { deletePlan, apiMeta as deletePlanMeta } from './handlers/deletePlan';
import { setActivePlan, apiMeta as setActivePlanMeta } from './handlers/setActivePlan';
import { duplicatePlan } from './handlers/duplicatePlan';
import { generatePlanFromText } from './handlers/generatePlanFromText';
import { createPlanFromText } from './handlers/createPlanFromText';
import { exportPlan } from './handlers/exportPlan';
import { matchImportedPlan } from './handlers/matchImportedPlan';
import { getSharedPlan } from './handlers/getSharedPlan';

// Export consolidated handlers object
export const trainingPlansApiHandlers = {
    [API_LIST_PLANS]: { process: listPlans, meta: listPlansMeta },
    [API_GET_PLAN]: { process: getPlan, meta: getPlanMeta },
    [API_CREATE_PLAN]: { process: createPlan, meta: createPlanMeta },
    [API_UPDATE_PLAN]: { process: updatePlan, meta: updatePlanMeta },
    [API_DELETE_PLAN]: { process: deletePlan, meta: deletePlanMeta },
    [API_SET_ACTIVE_PLAN]: { process: setActivePlan, meta: setActivePlanMeta },
    [API_DUPLICATE_PLAN]: { process: duplicatePlan },
    [API_GENERATE_PLAN_FROM_TEXT]: { process: generatePlanFromText },
    [API_CREATE_PLAN_FROM_TEXT]: { process: createPlanFromText },
    [API_EXPORT_PLAN]: { process: exportPlan },
    [API_MATCH_IMPORTED_PLAN]: { process: matchImportedPlan },
    [API_GET_SHARED_PLAN]: { process: getSharedPlan },
};


