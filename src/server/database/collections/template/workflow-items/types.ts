import type { ObjectId } from 'mongodb';
import type {
    DecisionOption,
    MetadataFieldConfig,
    DestinationOption,
    RoutingConfig,
    DecisionSelection,
} from '@/apis/template/agent-decision/types';

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

// ============================================================
// ARTIFACT TYPES
// ============================================================

export type ImplementationStatus = 'pending' | 'in-review' | 'approved' | 'changes-requested' | 'merged';

export interface DesignArtifactRecord {
    type: 'product-dev' | 'product-design' | 'tech-design';
    path: string;
    status: 'pending' | 'approved';
    lastUpdated: string;
    prNumber?: number;
}

export interface PhaseArtifactRecord {
    order: number;
    name: string;
    description: string;
    files: string[];
    estimatedSize: 'S' | 'M';
    status: ImplementationStatus;
    prNumber?: number;
}

export interface CommitMessageRecord {
    prNumber: number;
    title: string;
    body: string;
}

export interface DecisionArtifactRecord {
    agentId: string;
    type: string;
    context: string;
    options: DecisionOption[];
    metadataSchema: MetadataFieldConfig[];
    customDestinationOptions?: DestinationOption[];
    routing?: RoutingConfig;
    selection?: DecisionSelection;
}

export interface WorkflowItemArtifacts {
    designs?: DesignArtifactRecord[];
    phases?: PhaseArtifactRecord[];
    taskBranch?: string;
    commitMessages?: CommitMessageRecord[];
    decision?: DecisionArtifactRecord;
}

// ============================================================
// DOCUMENT TYPES
// ============================================================

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
    artifacts?: WorkflowItemArtifacts;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new workflow item
 */
export type WorkflowItemCreate = Omit<WorkflowItemDocument, '_id'>;
