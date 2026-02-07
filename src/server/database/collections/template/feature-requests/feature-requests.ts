import { Collection, ObjectId, Filter, Sort } from 'mongodb';
import { getDb } from '../../../connection';
import {
    FeatureRequestDocument,
    FeatureRequestCreate,
    FeatureRequestFilters,
    FeatureRequestStatus,
    FeatureRequestComment,
    FeatureRequestPriority,
} from './types';

/**
 * Get a reference to the feature-requests collection
 */
const getFeatureRequestsCollection = async (): Promise<Collection<FeatureRequestDocument>> => {
    const db = await getDb();
    return db.collection<FeatureRequestDocument>('feature-requests');
};

/**
 * Find all feature requests with optional filters
 */
export const findFeatureRequests = async (
    filters?: FeatureRequestFilters,
    sortBy: keyof FeatureRequestDocument = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
): Promise<FeatureRequestDocument[]> => {
    const collection = await getFeatureRequestsCollection();

    const query: Filter<FeatureRequestDocument> = {};

    if (filters?.status) {
        query.status = filters.status;
    }

    if (filters?.priority) {
        query.priority = filters.priority;
    }

    if (filters?.requestedBy) {
        query.requestedBy = typeof filters.requestedBy === 'string'
            ? new ObjectId(filters.requestedBy)
            : filters.requestedBy;
    }

    if (filters?.source) {
        query.source = filters.source;
    }

    if (filters?.startDate || filters?.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
            query.createdAt.$gte = filters.startDate;
        }
        if (filters.endDate) {
            query.createdAt.$lte = filters.endDate;
        }
    }

    const sort: Sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    return collection.find(query).sort(sort).toArray();
};

/**
 * Find feature requests by user (for "My Requests" page)
 */
export const findFeatureRequestsByUser = async (
    userId: ObjectId | string,
    sortOrder: 'asc' | 'desc' = 'desc'
): Promise<FeatureRequestDocument[]> => {
    const collection = await getFeatureRequestsCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return collection
        .find({ requestedBy: userIdObj })
        .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 })
        .toArray();
};

/**
 * Find a feature request by ID
 */
export const findFeatureRequestById = async (
    requestId: ObjectId | string
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    return collection.findOne({ _id: requestIdObj });
};

/**
 * Find a feature request by GitHub issue number
 */
export const findByGitHubIssueNumber = async (
    issueNumber: number
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    return collection.findOne({ githubIssueNumber: issueNumber });
};

/**
 * Create a new feature request
 */
export const createFeatureRequest = async (
    request: FeatureRequestCreate
): Promise<FeatureRequestDocument> => {
    const collection = await getFeatureRequestsCollection();

    const result = await collection.insertOne(request as FeatureRequestDocument);

    if (!result.insertedId) {
        throw new Error('Failed to create feature request');
    }

    return { ...request, _id: result.insertedId } as FeatureRequestDocument;
};

/**
 * Update a feature request's status
 */
export const updateFeatureRequestStatus = async (
    requestId: ObjectId | string,
    status: FeatureRequestStatus
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const updateData: Partial<FeatureRequestDocument> = {
        status,
        updatedAt: new Date(),
    };

    const result = await collection.findOneAndUpdate(
        { _id: requestIdObj },
        { $set: updateData },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Add a comment to a feature request
 */
export const addComment = async (
    requestId: ObjectId | string,
    comment: FeatureRequestComment
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const result = await collection.findOneAndUpdate(
        { _id: requestIdObj },
        {
            $push: { comments: comment },
            $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Update admin notes
 */
export const updateAdminNotes = async (
    requestId: ObjectId | string,
    adminNotes: string
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const result = await collection.findOneAndUpdate(
        { _id: requestIdObj },
        {
            $set: {
                adminNotes,
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Update priority
 */
export const updatePriority = async (
    requestId: ObjectId | string,
    priority: FeatureRequestPriority
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const result = await collection.findOneAndUpdate(
        { _id: requestIdObj },
        {
            $set: {
                priority,
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Toggle needsUserInput flag
 */
export const setNeedsUserInput = async (
    requestId: ObjectId | string,
    needsUserInput: boolean
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const result = await collection.findOneAndUpdate(
        { _id: requestIdObj },
        {
            $set: {
                needsUserInput,
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Delete a feature request
 */
export const deleteFeatureRequest = async (
    requestId: ObjectId | string
): Promise<boolean> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const result = await collection.deleteOne({ _id: requestIdObj });
    return result.deletedCount === 1;
};

/**
 * Update GitHub fields on a feature request
 */
export const updateGitHubFields = async (
    requestId: ObjectId | string,
    fields: {
        githubIssueUrl?: string;
        githubIssueNumber?: number;
        githubProjectItemId?: string;
        githubIssueTitle?: string;
    }
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const result = await collection.findOneAndUpdate(
        { _id: requestIdObj },
        {
            $set: {
                ...fields,
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Atomically claim (consume) the approval token.
 * Uses findOneAndUpdate with a condition so only the first caller succeeds.
 * Returns the document (with token) if claimed, null if already claimed or missing.
 */
export const claimApprovalToken = async (
    requestId: ObjectId | string
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    // $ne: null is valid MongoDB but conflicts with TypeScript's strict typing for optional string fields
    const filter = { _id: requestIdObj, approvalToken: { $exists: true, $ne: null } } as unknown as Filter<FeatureRequestDocument>;
    const result = await collection.findOneAndUpdate(
        filter,
        { $unset: { approvalToken: '' }, $set: { updatedAt: new Date() } },
        { returnDocument: 'before' }
    );

    return result || null;
};

/**
 * Update or clear the approval token
 */
export const updateApprovalToken = async (
    requestId: ObjectId | string,
    token: string | null
): Promise<boolean> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    if (token === null) {
        // Remove the token field
        const result = await collection.updateOne(
            { _id: requestIdObj },
            {
                $unset: { approvalToken: '' },
                $set: { updatedAt: new Date() },
            }
        );
        return result.modifiedCount === 1;
    }

    const result = await collection.updateOne(
        { _id: requestIdObj },
        {
            $set: {
                approvalToken: token,
                updatedAt: new Date(),
            },
        }
    );

    return result.modifiedCount === 1;
};

/**
 * Get feature request counts by status
 */
export const getFeatureRequestCounts = async (): Promise<Record<FeatureRequestStatus, number>> => {
    const collection = await getFeatureRequestsCollection();

    const pipeline = [
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
            },
        },
    ];

    const results = await collection.aggregate(pipeline).toArray();

    const counts: Record<FeatureRequestStatus, number> = {
        new: 0,
        in_progress: 0,
        done: 0,
        rejected: 0,
    };

    for (const result of results) {
        if (result._id in counts) {
            counts[result._id as FeatureRequestStatus] = result.count;
        }
    }

    return counts;
};

/**
 * Find feature requests by workflow status (for AppProjectAdapter)
 */
export const findByWorkflowStatus = async (
    workflowStatus?: string,
    workflowReviewStatus?: string
): Promise<FeatureRequestDocument[]> => {
    const collection = await getFeatureRequestsCollection();
    const query: Filter<FeatureRequestDocument> = {};

    if (workflowStatus) {
        query.workflowStatus = workflowStatus;
    }
    if (workflowReviewStatus) {
        query.workflowReviewStatus = workflowReviewStatus;
    }

    // Only return items that have been synced to GitHub (have a projectItemId)
    query.githubProjectItemId = { $exists: true, $ne: undefined };

    return collection.find(query).sort({ updatedAt: -1 }).toArray();
};

/**
 * Update workflow fields on a feature request
 */
export const updateWorkflowFields = async (
    requestId: ObjectId | string,
    fields: {
        workflowStatus?: string | null;
        workflowReviewStatus?: string | null;
        implementationPhase?: string | null;
    }
): Promise<void> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const $set: Record<string, unknown> = { updatedAt: new Date() };
    const $unset: Record<string, string> = {};

    for (const [key, value] of Object.entries(fields)) {
        if (value === null) {
            $unset[key] = '';
        } else if (value !== undefined) {
            $set[key] = value;
        }
    }

    const update: Record<string, unknown> = { $set };
    if (Object.keys($unset).length > 0) {
        update.$unset = $unset;
    }

    await collection.updateOne({ _id: requestIdObj }, update);
};
