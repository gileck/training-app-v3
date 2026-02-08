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
    itemId: string;
    status: string;
}

export interface UpdateWorkflowStatusResponse {
    success?: boolean;
    error?: string;
}
