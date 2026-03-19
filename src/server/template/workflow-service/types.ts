/**
 * Workflow Service Types
 *
 * Shared types used across all workflow service functions.
 */

export type ItemType = 'feature' | 'bug';
export type RoutingDestination = 'product-dev' | 'product-design' | 'tech-design' | 'implementation' | 'backlog';

export interface WorkflowItemRef {
    id: string;
    type: ItemType;
}

export interface ApproveOptions {
    initialRoute?: RoutingDestination;
    initialStatusOverride?: string;
}

export interface ApproveResult {
    success: boolean;
    error?: string;
    issueNumber?: number;
    issueUrl?: string;
    projectItemId?: string;
    needsRouting: boolean;
    title?: string;
}

export interface RouteResult {
    success: boolean;
    error?: string;
    targetStatus?: string;
    targetLabel?: string;
}

export interface DeleteOptions {
    force?: boolean;
}

export interface DeleteResult {
    success: boolean;
    error?: string;
    title?: string;
}

// ============================================================
// Phase 2 Types — Mid-pipeline operations
// ============================================================

/**
 * Common options for service functions that perform logging.
 */
export interface ServiceOptions {
    source?: string;
    logAction?: string;
    logDescription?: string;
    logMetadata?: Record<string, unknown>;
}

/**
 * Common result type for service operations.
 */
export interface ServiceResult {
    success: boolean;
    error?: string;
    itemId?: string;
}

/**
 * Result from advanceStatus with additional context.
 */
export interface AdvanceResult extends ServiceResult {
    previousStatus?: string;
}

/**
 * Result from markDone.
 */
export interface MarkDoneResult extends ServiceResult {
    sourceDocUpdated?: boolean;
    /** Errors encountered during status update operations (non-fatal) */
    statusUpdateErrors?: string[];
}

/**
 * Result from undoStatusChange.
 */
export interface UndoResult extends ServiceResult {
    expired?: boolean;
    alreadyDone?: boolean;
}

/**
 * Options for undo operations.
 */
export interface UndoOptions extends ServiceOptions {
    timestamp: number;
    undoWindowMs?: number;
}

/**
 * Result from autoAdvanceApproved.
 */
export interface AutoAdvanceResult {
    total: number;
    advanced: number;
    failed: number;
    details: Array<{
        issueNumber?: number;
        title: string;
        fromStatus: string;
        toStatus: string;
        success: boolean;
        error?: string;
    }>;
}

/**
 * Agent completion result — what the agent passes when it's done.
 */
export interface AgentCompletionResult {
    status?: string;
    reviewStatus?: string;
    clearReviewStatus?: boolean;
}
