import { ObjectId } from 'mongodb';

/**
 * Type of workflow item
 */
export type WorkflowItemType = 'feature' | 'bug' | 'task';

/**
 * Reference to the source document (feature-request or report)
 */
export interface SourceRef {
    collection: 'feature-requests' | 'reports';
    id: ObjectId;
}

/**
 * Workflow item document in the database
 *
 * Owns the workflow lifecycle (status, review status, implementation phase).
 * Source collections (feature-requests, reports) remain as intake/detail storage.
 */
export interface WorkflowItemDocument {
    _id: ObjectId;
    type: WorkflowItemType;
    title: string;
    description?: string;
    status: string;                // 'Backlog', 'Product Design', etc.
    reviewStatus?: string;         // 'Waiting for Review', 'Approved', etc.
    implementationPhase?: string;  // '1/3', '2/3', etc.
    sourceRef?: SourceRef;         // null for CLI tasks
    githubIssueNumber?: number;
    githubIssueUrl?: string;
    githubIssueTitle?: string;
    labels?: string[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new workflow item
 */
export type WorkflowItemCreate = Omit<WorkflowItemDocument, '_id'>;
