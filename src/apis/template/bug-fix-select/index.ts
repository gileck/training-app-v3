/**
 * Bug Fix Select API
 *
 * API for selecting a fix approach from bug investigation results.
 */

// Domain name
export const name = 'bug-fix-select';

// API endpoint names
export const API_GET_INVESTIGATION = 'bug-fix-select/getInvestigation';
export const API_SUBMIT_FIX_SELECTION = 'bug-fix-select/submitFixSelection';

// Export types
export type {
    ParsedFixOption,
    ParsedInvestigation,
    GetInvestigationRequest,
    GetInvestigationResponse,
    FixSelection,
    SubmitFixSelectionRequest,
    SubmitFixSelectionResponse,
} from './types';

// Export utilities (server-side only)
export {
    generateBugFixToken,
    validateBugFixToken,
    isInvestigationComment,
    parseInvestigation,
    formatFixDecisionComment,
    findBugInvestigationItem,
} from './utils';
