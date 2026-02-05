// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_GET_CLARIFICATION, API_SUBMIT_ANSWER } from './index';

// Import handlers
import { getClarification } from './handlers/getClarification';
import { submitAnswer } from './handlers/submitAnswer';

// Export consolidated handlers object
export const clarificationApiHandlers = {
    [API_GET_CLARIFICATION]: { process: getClarification },
    [API_SUBMIT_ANSWER]: { process: submitAnswer },
};
