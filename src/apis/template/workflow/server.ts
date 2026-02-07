// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_LIST_WORKFLOW_ITEMS } from './index';

// Import handlers
import { listItems } from './handlers/listItems';

// Export consolidated handlers object
export const workflowApiHandlers = {
    [API_LIST_WORKFLOW_ITEMS]: { process: listItems },
};
