// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import { API_AGENT_LOG_EVENT, API_AGENT_LOG_PHASE } from './index';

// Import handlers
import { logEvent } from './handlers/logEvent';
import { logPhase } from './handlers/logPhase';

// Export consolidated handlers object
export const agentLogApiHandlers = {
    [API_AGENT_LOG_EVENT]: { process: logEvent },
    [API_AGENT_LOG_PHASE]: { process: logPhase },
};
