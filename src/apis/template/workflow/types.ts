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

export const WORKFLOW_HISTORY_ACTIONS = {
    feature_approved: 'Feature approved',
    bug_approved: 'Bug approved',
    status_advanced: 'Status advanced',
    marked_done: 'Marked done',
    routed: 'Routed',
    pr_merged: 'PR merged',
    design_pr_merged: 'Design PR merged',
    final_pr_merged: 'Final PR merged',
    design_approved: 'Design approved',
    design_changes: 'Design changes requested',
    design_rejected: 'Design rejected',
    pr_changes_requested: 'PR changes requested',
    design_pr_changes_requested: 'Design PR changes requested',
    agent_completed: 'Agent completed',
    agent_started: 'Agent started',
    clarification_received: 'Clarification received',
    choose_recommended: 'Recommended option chosen',
    status_changed: 'Status changed',
    undo: 'Action undone',
    revert_initiated: 'Revert initiated',
    revert_merged: 'Revert merged',
    decision_routed: 'Decision routed',
    created: 'Item created',
} as const;

export type WorkflowHistoryAction = keyof typeof WORKFLOW_HISTORY_ACTIONS;

export interface WorkflowHistoryEntry {
    action: WorkflowHistoryAction | (string & {});
    description: string;
    timestamp: string;
    actor?: string;
    metadata?: Record<string, unknown>;
}

export interface WorkflowItem {
    id: string;
    /** Composite ID for navigation to detail page (e.g., "feature:mongoId" or "report:mongoId") */
    sourceId: string | null;
    /** Item type: feature, bug, or task */
    type: 'feature' | 'bug' | 'task';
    status: string | null;
    reviewStatus: string | null;
    priority?: 'critical' | 'high' | 'medium' | 'low';
    size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
    complexity?: 'High' | 'Medium' | 'Low';
    domain?: string;
    description?: string;
    content: WorkflowItemContent | null;
    implementationPhase?: string | null;
    prData?: WorkflowItemPRData;
    history?: WorkflowHistoryEntry[];
    reviewed?: boolean;
    reviewSummary?: string;
    createdBy?: string;
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
    | 'approve-design'
    | 'merge-design-pr'
    | 'merge-pr'
    | 'merge-final-pr'
    | 'revert-pr'
    | 'merge-revert-pr'
    | 'request-changes-design-pr'
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

// ============================================================================
// Update Fields API
// ============================================================================

export interface UpdateWorkflowFieldsRequest {
    itemId: string;
    fields: {
        priority?: 'critical' | 'high' | 'medium' | 'low' | null;
        size?: 'XS' | 'S' | 'M' | 'L' | 'XL' | null;
        complexity?: 'High' | 'Medium' | 'Low' | null;
        domain?: string | null;
    };
}

export interface UpdateWorkflowFieldsResponse {
    success?: boolean;
    error?: string;
}
