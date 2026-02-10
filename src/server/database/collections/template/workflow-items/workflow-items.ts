import { Collection, ObjectId, Filter } from 'mongodb';
import { getDb } from '../../../connection';
import type {
    WorkflowItemDocument,
    WorkflowItemCreate,
    WorkflowItemArtifacts,
    DesignArtifactRecord,
    PhaseArtifactRecord,
    CommitMessageRecord,
    DecisionArtifactRecord,
    ImplementationStatus,
} from './types';
import type { DecisionSelection } from '@/apis/template/agent-decision/types';

/**
 * Get a reference to the workflow-items collection
 */
const getWorkflowItemsCollection = async (): Promise<Collection<WorkflowItemDocument>> => {
    const db = await getDb();
    return db.collection<WorkflowItemDocument>('workflow-items');
};

/**
 * Create a new workflow item
 */
export const createWorkflowItem = async (
    item: WorkflowItemCreate
): Promise<WorkflowItemDocument> => {
    const collection = await getWorkflowItemsCollection();
    const result = await collection.insertOne(item as WorkflowItemDocument);

    if (!result.insertedId) {
        throw new Error('Failed to create workflow item');
    }

    return { ...item, _id: result.insertedId } as WorkflowItemDocument;
};

/**
 * Find a workflow item by ID
 */
export const findWorkflowItemById = async (
    id: ObjectId | string
): Promise<WorkflowItemDocument | null> => {
    const collection = await getWorkflowItemsCollection();
    const idObj = typeof id === 'string' ? new ObjectId(id) : id;
    return collection.findOne({ _id: idObj });
};

/**
 * Find a workflow item by source reference (collection + source document ID)
 */
export const findWorkflowItemBySourceRef = async (
    sourceCollection: 'feature-requests' | 'reports',
    sourceId: ObjectId | string
): Promise<WorkflowItemDocument | null> => {
    const collection = await getWorkflowItemsCollection();
    const sourceIdObj = typeof sourceId === 'string' ? new ObjectId(sourceId) : sourceId;
    return collection.findOne({
        'sourceRef.collection': sourceCollection,
        'sourceRef.id': sourceIdObj,
    });
};

/**
 * Find all workflow items with optional filters
 */
export const findAllWorkflowItems = async (
    status?: string,
    reviewStatus?: string
): Promise<WorkflowItemDocument[]> => {
    const collection = await getWorkflowItemsCollection();
    const query: Filter<WorkflowItemDocument> = {};

    if (status) {
        query.status = status;
    }
    if (reviewStatus) {
        query.reviewStatus = reviewStatus;
    }

    return collection.find(query).sort({ updatedAt: -1 }).toArray();
};

/**
 * Update workflow fields on a workflow item (status, reviewStatus, implementationPhase)
 */
export const updateWorkflowFields = async (
    id: ObjectId | string,
    fields: {
        workflowStatus?: string | null;
        workflowReviewStatus?: string | null;
        implementationPhase?: string | null;
    }
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    const idObj = typeof id === 'string' ? new ObjectId(id) : id;

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    const $unset: Record<string, string> = {};

    // Map workflowStatus -> status, workflowReviewStatus -> reviewStatus on the document
    const fieldMap: Record<string, string> = {
        workflowStatus: 'status',
        workflowReviewStatus: 'reviewStatus',
        implementationPhase: 'implementationPhase',
    };

    for (const [key, value] of Object.entries(fields)) {
        const docField = fieldMap[key] || key;
        if (value === null) {
            $unset[docField] = '';
        } else if (value !== undefined) {
            $set[docField] = value;
        }
    }

    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length > 0) {
        update.$unset = $unset;
    }

    await collection.updateOne({ _id: idObj }, update);
};

/**
 * Update GitHub fields on a workflow item
 */
export const updateGitHubFields = async (
    id: ObjectId | string,
    fields: {
        githubIssueNumber?: number;
        githubIssueUrl?: string;
        githubIssueTitle?: string;
    }
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    const idObj = typeof id === 'string' ? new ObjectId(id) : id;

    await collection.updateOne(
        { _id: idObj },
        { $set: { ...fields, updatedAt: new Date() } }
    );
};

// ============================================================
// ARTIFACT OPERATIONS
// ============================================================

/**
 * Find a workflow item by GitHub issue number
 */
export const findWorkflowItemByIssueNumber = async (
    issueNumber: number
): Promise<WorkflowItemDocument | null> => {
    const collection = await getWorkflowItemsCollection();
    return collection.findOne({ githubIssueNumber: issueNumber });
};

/**
 * Get artifacts for a workflow item by issue number
 */
export const getArtifacts = async (
    issueNumber: number
): Promise<WorkflowItemArtifacts | null> => {
    const item = await findWorkflowItemByIssueNumber(issueNumber);
    return item?.artifacts ?? null;
};

/**
 * Upsert a design artifact in artifacts.designs by type
 */
export const updateDesignArtifactInDB = async (
    issueNumber: number,
    design: DesignArtifactRecord
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();

    // First try to update an existing design of the same type
    const result = await collection.updateOne(
        { githubIssueNumber: issueNumber, 'artifacts.designs.type': design.type },
        {
            $set: {
                'artifacts.designs.$': design,
                updatedAt: new Date(),
            },
        }
    );

    if (result.matchedCount === 0) {
        // No existing design of this type - push a new one
        await collection.updateOne(
            { githubIssueNumber: issueNumber },
            {
                $push: { 'artifacts.designs': design },
                $set: { updatedAt: new Date() },
            }
        );
    }
};

/**
 * Replace all phases in artifacts.phases
 */
export const setPhases = async (
    issueNumber: number,
    phases: PhaseArtifactRecord[]
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        {
            $set: {
                'artifacts.phases': phases,
                updatedAt: new Date(),
            },
        }
    );
};

/**
 * Update a specific phase's status and optional prNumber
 */
export const updatePhaseStatus = async (
    issueNumber: number,
    order: number,
    fields: { status: ImplementationStatus; prNumber?: number }
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();

    const $set: Record<string, unknown> = {
        'artifacts.phases.$[phase].status': fields.status,
        updatedAt: new Date(),
    };
    if (fields.prNumber !== undefined) {
        $set['artifacts.phases.$[phase].prNumber'] = fields.prNumber;
    }

    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        { $set },
        { arrayFilters: [{ 'phase.order': order }] }
    );
};

/**
 * Set the task branch in artifacts
 */
export const setTaskBranchInDB = async (
    issueNumber: number,
    branch: string
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        {
            $set: {
                'artifacts.taskBranch': branch,
                updatedAt: new Date(),
            },
        }
    );
};

/**
 * Clear the task branch from artifacts
 */
export const clearTaskBranchInDB = async (
    issueNumber: number
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        {
            $unset: { 'artifacts.taskBranch': '' },
            $set: { updatedAt: new Date() },
        }
    );
};

/**
 * Upsert a commit message in artifacts.commitMessages by prNumber
 */
export const setCommitMessage = async (
    issueNumber: number,
    prNumber: number,
    title: string,
    body: string
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    const record: CommitMessageRecord = { prNumber, title, body };

    // Try to update existing entry for this PR
    const result = await collection.updateOne(
        { githubIssueNumber: issueNumber, 'artifacts.commitMessages.prNumber': prNumber },
        {
            $set: {
                'artifacts.commitMessages.$': record,
                updatedAt: new Date(),
            },
        }
    );

    if (result.matchedCount === 0) {
        // No existing entry - push a new one
        await collection.updateOne(
            { githubIssueNumber: issueNumber },
            {
                $push: { 'artifacts.commitMessages': record },
                $set: { updatedAt: new Date() },
            }
        );
    }
};

/**
 * Get a commit message by issue number and PR number
 */
export const getCommitMessageFromDB = async (
    issueNumber: number,
    prNumber: number
): Promise<CommitMessageRecord | null> => {
    const artifacts = await getArtifacts(issueNumber);
    return artifacts?.commitMessages?.find(cm => cm.prNumber === prNumber) ?? null;
};

/**
 * Set the decision artifact
 */
export const setDecision = async (
    issueNumber: number,
    decision: DecisionArtifactRecord
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        {
            $set: {
                'artifacts.decision': decision,
                updatedAt: new Date(),
            },
        }
    );
};

/**
 * Delete a workflow item by its _id
 */
export const deleteWorkflowItem = async (
    id: ObjectId | string
): Promise<boolean> => {
    const collection = await getWorkflowItemsCollection();
    const idObj = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await collection.deleteOne({ _id: idObj });
    return result.deletedCount > 0;
};

/**
 * Delete a workflow item by its source reference
 */
export const deleteWorkflowItemBySourceRef = async (
    sourceCollection: 'feature-requests' | 'reports',
    sourceId: ObjectId | string
): Promise<boolean> => {
    const collection = await getWorkflowItemsCollection();
    const sourceIdObj = typeof sourceId === 'string' ? new ObjectId(sourceId) : sourceId;
    const result = await collection.deleteOne({
        'sourceRef.collection': sourceCollection,
        'sourceRef.id': sourceIdObj,
    });
    return result.deletedCount > 0;
};

/**
 * Set the final PR number in artifacts
 */
export const setFinalPrNumber = async (
    issueNumber: number,
    prNumber: number
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        {
            $set: {
                'artifacts.finalPrNumber': prNumber,
                updatedAt: new Date(),
            },
        }
    );
};

/**
 * Set the last merged PR info in artifacts
 */
export const setLastMergedPr = async (
    issueNumber: number,
    prNumber: number,
    phase?: string
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        {
            $set: {
                'artifacts.lastMergedPr': {
                    prNumber,
                    ...(phase ? { phase } : {}),
                    mergedAt: new Date().toISOString(),
                },
                updatedAt: new Date(),
            },
        }
    );
};

/**
 * Set the pending revert PR number in artifacts
 */
export const setRevertPrNumber = async (
    issueNumber: number,
    revertPrNumber: number
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        {
            $set: {
                'artifacts.revertPrNumber': revertPrNumber,
                updatedAt: new Date(),
            },
        }
    );
};

/**
 * Clear the pending revert PR number from artifacts
 */
export const clearRevertPrNumber = async (
    issueNumber: number
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        {
            $unset: { 'artifacts.revertPrNumber': '' },
            $set: { updatedAt: new Date() },
        }
    );
};

/**
 * Set the decision selection within the decision artifact
 */
export const setDecisionSelection = async (
    issueNumber: number,
    selection: DecisionSelection
): Promise<void> => {
    const collection = await getWorkflowItemsCollection();
    await collection.updateOne(
        { githubIssueNumber: issueNumber },
        {
            $set: {
                'artifacts.decision.selection': selection,
                updatedAt: new Date(),
            },
        }
    );
};
