// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_GET_DECISION, API_SUBMIT_DECISION } from './index';

// Import handlers
import { getDecision } from './handlers/getDecision';
import { submitDecision } from './handlers/submitDecision';

// Export consolidated handlers object
export const agentDecisionApiHandlers = {
    [API_GET_DECISION]: { process: getDecision },
    [API_SUBMIT_DECISION]: { process: submitDecision },
};
