import { Collection, ObjectId, Filter, Sort } from 'mongodb';
import { getDb } from '@/server/database';
import {
    FeatureRequestDocument,
    FeatureRequestCreate,
    FeatureRequestFilters,
    FeatureRequestStatus,
    DesignPhase,
    DesignReviewStatus,
    DesignPhaseType,
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
 * Update a design phase content (used by agent)
 */
export const updateDesignContent = async (
    requestId: ObjectId | string,
    phase: DesignPhaseType,
    content: string,
    reviewStatus: DesignReviewStatus = 'pending_review'
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const existing = await collection.findOne({ _id: requestIdObj });
    if (!existing) return null;

    const fieldName = phase === 'product' ? 'productDesign' : 'techDesign';
    const currentPhase = existing[fieldName];

    const updatedPhase: DesignPhase = {
        content,
        reviewStatus,
        adminComments: currentPhase?.adminComments,
        iterations: (currentPhase?.iterations || 0) + 1,
        generatedAt: new Date(),
        approvedAt: currentPhase?.approvedAt,
    };

    const result = await collection.findOneAndUpdate(
        { _id: requestIdObj },
        {
            $set: {
                [fieldName]: updatedPhase,
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Set design phase review status (used by admin to approve/reject)
 */
export const setDesignReviewStatus = async (
    requestId: ObjectId | string,
    phase: DesignPhaseType,
    reviewStatus: DesignReviewStatus,
    adminComments?: string
): Promise<FeatureRequestDocument | null> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const existing = await collection.findOne({ _id: requestIdObj });
    if (!existing) return null;

    const fieldName = phase === 'product' ? 'productDesign' : 'techDesign';
    const currentPhase = existing[fieldName];

    if (!currentPhase) return null;

    const updatedPhase: DesignPhase = {
        ...currentPhase,
        reviewStatus,
        adminComments: adminComments ?? currentPhase.adminComments,
        approvedAt: reviewStatus === 'approved' ? new Date() : currentPhase.approvedAt,
    };

    const updateData: Partial<FeatureRequestDocument> = {
        [fieldName]: updatedPhase,
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
 * Find feature requests that need design work (for agent)
 *
 * NOTE: With simplified status schema, agents should query GitHub Projects directly.
 * This function is kept for backwards compatibility but is no longer the primary
 * way to find work - agents use GitHub Projects API instead.
 *
 * Returns in_progress requests with design phases that need work.
 */
export const findPendingDesignWork = async (
    phase?: DesignPhaseType,
    limit?: number
): Promise<FeatureRequestDocument[]> => {
    const collection = await getFeatureRequestsCollection();

    const conditions: Filter<FeatureRequestDocument>[] = [];

    if (!phase || phase === 'product') {
        conditions.push({
            status: 'in_progress',
            $or: [
                { 'productDesign.reviewStatus': 'not_started' },
                { 'productDesign.reviewStatus': 'rejected' },
                { productDesign: { $exists: false } },
            ],
        });
    }

    if (!phase || phase === 'tech') {
        conditions.push({
            status: 'in_progress',
            $or: [
                { 'techDesign.reviewStatus': 'not_started' },
                { 'techDesign.reviewStatus': 'rejected' },
                { techDesign: { $exists: false } },
            ],
        });
    }

    const query: Filter<FeatureRequestDocument> = conditions.length === 1
        ? conditions[0]
        : { $or: conditions };

    let cursor = collection.find(query).sort({ createdAt: 1 }); // Oldest first

    if (limit) {
        cursor = cursor.limit(limit);
    }

    return cursor.toArray();
};

/**
 * Mark a design phase as in_progress (to prevent duplicate processing)
 */
export const markDesignInProgress = async (
    requestId: ObjectId | string,
    phase: DesignPhaseType
): Promise<boolean> => {
    const collection = await getFeatureRequestsCollection();
    const requestIdObj = typeof requestId === 'string' ? new ObjectId(requestId) : requestId;

    const fieldName = phase === 'product' ? 'productDesign' : 'techDesign';

    const result = await collection.updateOne(
        {
            _id: requestIdObj,
            $or: [
                { [`${fieldName}.reviewStatus`]: 'not_started' },
                { [`${fieldName}.reviewStatus`]: 'rejected' },
                { [fieldName]: { $exists: false } },
            ],
        },
        {
            $set: {
                [`${fieldName}.reviewStatus`]: 'in_progress',
                updatedAt: new Date(),
            },
        }
    );

    return result.modifiedCount === 1;
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
        githubProjectStatus?: string;
        githubReviewStatus?: string;
        githubPrUrl?: string;
        githubPrNumber?: number;
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
