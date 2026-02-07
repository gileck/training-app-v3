/**
 * Agent Decision API
 *
 * Generic API for agent decision flows where an agent presents
 * options and an admin selects one via a web UI.
 */

// Domain name
export const name = 'agent-decision';

// API endpoint names
export const API_GET_DECISION = 'agent-decision/getDecision';
export const API_SUBMIT_DECISION = 'agent-decision/submitDecision';

// Export types
export type {
    MetadataFieldConfig,
    DestinationOption,
    RoutingConfig,
    DecisionOption,
    ParsedDecision,
    GetDecisionRequest,
    GetDecisionResponse,
    DecisionSelection,
    SubmitDecisionRequest,
    SubmitDecisionResponse,
} from './types';

// Export utilities (server-side only)
export {
    generateDecisionToken,
    validateDecisionToken,
    isDecisionComment,
    parseDecision,
    formatDecisionComment,
    formatDecisionSelectionComment,
    findDecisionItem,
    isSelectionComment,
    parseSelectionComment,
} from './utils';
