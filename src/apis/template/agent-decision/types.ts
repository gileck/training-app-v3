/**
 * Agent Decision API Types
 *
 * Generic types for the agent decision system. Any agent can present
 * decision options to the admin via a web UI using these types.
 *
 * Options use a fixed core (id, title, description, isRecommended) plus
 * flexible metadata (Record<string, string | string[]>) with a metadataSchema
 * that tells the UI how to render each field.
 */

// ============================================================
// METADATA SCHEMA
// ============================================================

/**
 * Describes how to render a single metadata field in the UI.
 */
export interface MetadataFieldConfig {
    /** Key in the option's metadata record */
    key: string;
    /** Display label */
    label: string;
    /** How to render this field */
    type: 'badge' | 'text' | 'file-list' | 'tag';
    /**
     * Optional color map for badge type.
     * Maps values to Tailwind color classes.
     * e.g. { "S": "green", "M": "yellow", "L": "orange", "XL": "red" }
     */
    colorMap?: Record<string, string>;
}

/**
 * Custom destination option for routing decisions.
 */
export interface DestinationOption {
    /** Internal value (e.g. "implement", "tech-design") */
    value: string;
    /** Display label (e.g. "Implementation", "Technical Design") */
    label: string;
}

/**
 * Optional routing config embedded in DECISION_META by agents.
 * Allows the submit handler to auto-route the item to a new status.
 */
export interface RoutingConfig {
    /** Which metadata key on the option contains the routing value */
    metadataKey: string;
    /** Maps metadata values to project status names */
    statusMap: Record<string, string>;
    /** Maps custom destination values to project status names (for custom solutions) */
    customDestinationStatusMap?: Record<string, string>;
}

// ============================================================
// DECISION OPTION TYPES
// ============================================================

/**
 * A decision option parsed from an agent's comment.
 * Core fields are fixed; agent-specific data goes in metadata.
 */
export interface DecisionOption {
    /** Unique identifier (e.g. "opt1", "opt2") */
    id: string;
    /** Title of the option */
    title: string;
    /** Detailed description (markdown) */
    description: string;
    /** Whether this is the recommended option */
    isRecommended: boolean;
    /** Flexible metadata (agent-specific fields) */
    metadata: Record<string, string | string[]>;
}

/**
 * Full parsed decision data from a GitHub issue comment.
 */
export interface ParsedDecision {
    /** The GitHub issue number */
    issueNumber: number;
    /** Issue title */
    issueTitle: string;
    /** Decision type identifier (e.g. "bug-fix", "tech-design") */
    decisionType: string;
    /** Agent that created this decision */
    agentId: string;
    /** Context markdown (displayed before options) */
    context: string;
    /** Available options */
    options: DecisionOption[];
    /** Schema for rendering metadata fields */
    metadataSchema: MetadataFieldConfig[];
    /** Available destination options for custom solutions (if applicable) */
    customDestinationOptions?: DestinationOption[];
    /** Optional routing config — if present, submit handler auto-routes the item */
    routing?: RoutingConfig;
}

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================

/**
 * Request to get decision data for an issue
 */
export interface GetDecisionRequest {
    /** GitHub issue number */
    issueNumber: number;
    /** Security token (8-char hash) */
    token: string;
}

/**
 * Response with decision data
 */
export interface GetDecisionResponse {
    /** Parsed decision data */
    decision?: ParsedDecision;
    /** Error message if failed */
    error?: string;
}

/**
 * Selected option from the UI
 */
export interface DecisionSelection {
    /** ID of the selected option (or "custom" for custom solution). Optional when chooseRecommended is true. */
    selectedOptionId?: string;
    /** Set to true to auto-select the recommended option (selectedOptionId not needed) */
    chooseRecommended?: boolean;
    /** Custom solution text (required if selectedOptionId is "custom") */
    customSolution?: string;
    /** Custom destination value (required if selectedOptionId is "custom" and destinations exist) */
    customDestination?: string;
    /** Optional additional notes */
    notes?: string;
}

/**
 * Request to submit a decision selection
 */
export interface SubmitDecisionRequest {
    /** GitHub issue number */
    issueNumber: number;
    /** Security token (8-char hash) */
    token: string;
    /** The selection */
    selection: DecisionSelection;
}

/**
 * Response after submitting a decision selection
 */
export interface SubmitDecisionResponse {
    /** Whether submission was successful */
    success?: boolean;
    /** The status the item was routed to (if routing config was present) */
    routedTo?: string;
    /** Error message if failed */
    error?: string;
}
