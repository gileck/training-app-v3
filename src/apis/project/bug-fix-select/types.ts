/**
 * Bug Fix Select API Types
 *
 * Types for the bug fix selection flow that allows admins to choose
 * a fix approach from the investigation results via a web UI.
 */

// ============================================================
// FIX OPTION TYPES
// ============================================================

/**
 * A fix option parsed from the investigation comment.
 * These are extracted from the Bug Investigator agent's output.
 */
export interface ParsedFixOption {
    /** Unique identifier for the option (e.g., "opt1", "opt2") */
    id: string;
    /** Title of the fix approach */
    title: string;
    /** Detailed description */
    description: string;
    /** Where this fix should route to */
    destination: 'implement' | 'tech-design';
    /** Estimated complexity */
    complexity: 'S' | 'M' | 'L' | 'XL';
    /** Files that would be affected */
    filesAffected: string[];
    /** Trade-offs or considerations */
    tradeoffs?: string;
    /** Whether this is the recommended option */
    isRecommended: boolean;
}

/**
 * Full parsed investigation data from the GitHub issue.
 */
export interface ParsedInvestigation {
    /** The GitHub issue number */
    issueNumber: number;
    /** Issue title */
    issueTitle: string;
    /** Whether root cause was found */
    rootCauseFound: boolean;
    /** Confidence level */
    confidence: 'low' | 'medium' | 'high';
    /** Root cause analysis text */
    rootCauseAnalysis: string;
    /** Available fix options */
    fixOptions: ParsedFixOption[];
}

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================

/**
 * Request to get investigation data for an issue
 */
export interface GetInvestigationRequest {
    /** GitHub issue number */
    issueNumber: number;
    /** Security token (8-char hash) */
    token: string;
}

/**
 * Response with investigation data
 */
export interface GetInvestigationResponse {
    /** Parsed investigation data */
    investigation?: ParsedInvestigation;
    /** Error message if failed */
    error?: string;
}

/**
 * Selected fix option from the UI
 */
export interface FixSelection {
    /** ID of the selected option (or "custom" for custom solution) */
    selectedOptionId: string;
    /** Custom solution text (required if selectedOptionId is "custom") */
    customSolution?: string;
    /** Custom destination (required if selectedOptionId is "custom") */
    customDestination?: 'implement' | 'tech-design';
    /** Optional additional notes */
    notes?: string;
}

/**
 * Request to submit fix selection
 */
export interface SubmitFixSelectionRequest {
    /** GitHub issue number */
    issueNumber: number;
    /** Security token (8-char hash) */
    token: string;
    /** The fix selection */
    selection: FixSelection;
}

/**
 * Response after submitting fix selection
 */
export interface SubmitFixSelectionResponse {
    /** Whether submission was successful */
    success?: boolean;
    /** The destination the bug was routed to */
    routedTo?: 'implement' | 'tech-design';
    /** Error message if failed */
    error?: string;
}
