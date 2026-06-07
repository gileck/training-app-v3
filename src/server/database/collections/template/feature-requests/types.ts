import type { ObjectId } from 'mongodb';

/**
 * Status for a feature request
 * - new: Newly submitted, not yet triaged
 * - in_progress: Being worked on
 * - done: Completed
 * - rejected: Not going to implement
 */
export type FeatureRequestStatus =
    | 'new'              // Newly submitted
    | 'in_progress'      // Being worked on
    | 'done'             // Completed
    | 'rejected';        // Not going to implement

/**
 * Priority level for feature requests
 */
export type FeatureRequestPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Source of the feature request - where it was created from
 */
export type FeatureRequestSource = 'ui' | 'cli';

/**
 * Comment in a feature request discussion
 */
export interface FeatureRequestComment {
    id: string;
    authorId: ObjectId;
    authorName: string;
    isAdmin: boolean;
    content: string;
    createdAt: Date;
}

/**
 * Client-friendly comment with string IDs and dates
 */
export interface FeatureRequestCommentClient {
    id: string;
    authorId: string;
    authorName: string;
    isAdmin: boolean;
    content: string;
    createdAt: string;
}

/**
 * Feature request document in the database
 */
export interface FeatureRequestDocument {
    _id: ObjectId;

    // Core fields (from user submission)
    title: string;
    description: string;
    page?: string;                    // Which page/area it relates to

    // Main workflow status
    status: FeatureRequestStatus;

    // User interaction
    needsUserInput: boolean;          // True when admin needs more info from user
    requestedBy: ObjectId;            // User who submitted
    requestedByName?: string;         // Username of who submitted
    comments: FeatureRequestComment[];

    // Admin-only fields
    adminNotes?: string;              // Internal notes (not shown to user)
    priority?: FeatureRequestPriority;

    // Source tracking
    source?: FeatureRequestSource;    // Where this was created from (ui, cli)

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new feature request
 */
export type FeatureRequestCreate = Omit<FeatureRequestDocument, '_id'>;

/**
 * Client-friendly feature request with string IDs and dates
 */
export interface FeatureRequestClient {
    _id: string;
    title: string;
    description: string;
    page?: string;
    status: FeatureRequestStatus;
    needsUserInput: boolean;
    requestedBy: string;
    requestedByName: string;
    comments: FeatureRequestCommentClient[];
    adminNotes?: string;
    priority?: FeatureRequestPriority;
    source?: FeatureRequestSource;
    createdAt: string;
    updatedAt: string;
}

/**
 * Filters for querying feature requests
 */
export interface FeatureRequestFilters {
    status?: FeatureRequestStatus;
    priority?: FeatureRequestPriority;
    requestedBy?: ObjectId | string;
    source?: FeatureRequestSource;
    startDate?: Date;
    endDate?: Date;
}
