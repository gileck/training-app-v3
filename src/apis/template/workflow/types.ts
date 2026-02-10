/**
 * Workflow API Types
 *
 * Client-facing types for the workflow items list API.
 */

// ============================================================================
// Shared Types
// ============================================================================

/**
 * A pending item (feature request or bug report awaiting approval)
 */
export interface PendingItem {
    id: string;
    type: 'feature' | 'bug';
    title: string;
    source?: string;
    priority?: string;
    createdAt: string;
}

export interface WorkflowItemContent {
    type: 'Issue' | 'DraftIssue' | 'PullRequest';
    number?: number;
    title: string;
    url?: string;
    state?: 'OPEN' | 'CLOSED';
    labels?: string[];
}

export interface WorkflowItemPRData {
    currentPrNumber?: number;
    designPrs?: { type: string; prNumber: number }[];
    hasPendingDecision?: boolean;
    finalPrNumber?: number;
    lastMergedPrNumber?: number;
    lastMergedPrPhase?: string;
    revertPrNumber?: number;
}

export interface WorkflowItem {
    id: string;
    /** Composite ID for navigation to detail page (e.g., "feature:mongoId" or "report:mongoId") */
    sourceId: string | null;
    /** Item type: feature, bug, or task */
    type: 'feature' | 'bug' | 'task';
    status: string | null;
    reviewStatus: string | null;
    content: WorkflowItemContent | null;
    implementationPhase?: string | null;
    prData?: WorkflowItemPRData;
    createdAt: string | null;
}

// ============================================================================
// API Request/Response
// ============================================================================

export type ListWorkflowItemsRequest = Record<string, never>;

export interface ListWorkflowItemsResponse {
    pendingItems?: PendingItem[];
    workflowItems?: WorkflowItem[];
    error?: string;
}

export interface UpdateWorkflowStatusRequest {
    itemId?: string;
    status: string;
    /** Alternative to itemId: look up workflow item by source document ID */
    sourceId?: string;
    /** Required if sourceId is provided */
    sourceType?: 'feature' | 'bug';
}

export interface UpdateWorkflowStatusResponse {
    success?: boolean;
    error?: string;
}

// ============================================================================
// Workflow Action API
// ============================================================================

export type WorkflowActionType =
    | 'review-approve'
    | 'review-changes'
    | 'review-reject'
    | 'request-changes-pr'
    | 'clarification-received'
    | 'choose-recommended'
    | 'mark-done'
    | 'merge-design-pr'
    | 'merge-pr'
    | 'merge-final-pr'
    | 'revert-pr'
    | 'merge-revert-pr'
    | 'undo-action';

export interface WorkflowActionRequest {
    action: WorkflowActionType;
    issueNumber: number;
    prNumber?: number;
    designType?: string;
    phase?: string;
    originalAction?: WorkflowActionType;
    timestamp?: number;
}

export interface WorkflowActionResponse {
    success?: boolean;
    error?: string;
    message?: string;
}
