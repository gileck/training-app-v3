// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_GET_INVESTIGATION, API_SUBMIT_FIX_SELECTION } from './index';

// Import handlers
import { getInvestigation } from './handlers/getInvestigation';
import { submitFixSelection } from './handlers/submitFixSelection';

// Export consolidated handlers object
export const bugFixSelectApiHandlers = {
    [API_GET_INVESTIGATION]: { process: getInvestigation },
    [API_SUBMIT_FIX_SELECTION]: { process: submitFixSelection },
};
