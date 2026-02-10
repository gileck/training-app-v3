// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_LIST_WORKFLOW_ITEMS, API_UPDATE_WORKFLOW_STATUS, API_WORKFLOW_ACTION } from './index';

// Import handlers
import { listItems } from './handlers/listItems';
import { updateStatus } from './handlers/updateStatus';
import { workflowAction } from './handlers/workflowAction';

// Export consolidated handlers object
export const workflowApiHandlers = {
    [API_LIST_WORKFLOW_ITEMS]: { process: listItems },
    [API_UPDATE_WORKFLOW_STATUS]: { process: updateStatus },
    [API_WORKFLOW_ACTION]: { process: workflowAction },
};
