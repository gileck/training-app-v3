import type { ObjectId } from 'mongodb';
import type {
    DecisionOption,
    MetadataFieldConfig,
    DestinationOption,
    RoutingConfig,
    DecisionSelection,
} from '@/apis/template/agent-decision/types';
import type { WorkflowHistoryAction } from '@/apis/template/workflow/types';

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
    finalPrNumber?: number;
    lastMergedPr?: {
        prNumber: number;
        phase?: string;       // e.g. "2/3"
        mergedAt: string;     // ISO timestamp
    };
    revertPrNumber?: number;  // pending revert PR after revertMerge()
}

// ============================================================
// HISTORY TYPES
// ============================================================

export interface HistoryEntry {
    action: WorkflowHistoryAction | (string & {});
    description: string;      // 'Routed to Technical Design'
    timestamp: string;        // ISO 8601
    actor?: string;           // 'admin', 'agent:tech-design', 'system'
    metadata?: Record<string, unknown>;
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
    priority?: 'critical' | 'high' | 'medium' | 'low';
    size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
    complexity?: 'High' | 'Medium' | 'Low';
    domain?: string;
    artifacts?: WorkflowItemArtifacts;
    history?: HistoryEntry[];
    reviewed?: boolean;
    reviewSummary?: string;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new workflow item
 */
export type WorkflowItemCreate = Omit<WorkflowItemDocument, '_id'>;
