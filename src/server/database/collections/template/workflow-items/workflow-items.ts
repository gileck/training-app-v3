import { Collection, ObjectId, Filter } from 'mongodb';
import { getDb } from '../../../connection';
import type { WorkflowItemDocument, WorkflowItemCreate } from './types';

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
