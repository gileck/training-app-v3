import { ObjectId } from 'mongodb';

/**
 * Main workflow status for a feature request
 *
 * Simplified schema - detailed workflow tracking happens in GitHub Projects.
 * MongoDB only tracks high-level state:
 * - new: Not yet synced to GitHub
 * - in_progress: Synced to GitHub, check GitHub Project for detailed status
 * - done: Completed and merged
 * - rejected: Not going to implement
 */
export type FeatureRequestStatus =
    | 'new'              // Not yet synced to GitHub
    | 'in_progress'      // Exists in GitHub (detailed status tracked in GitHub Projects)
    | 'done'             // Completed
    | 'rejected';        // Not going to implement

/**
 * Priority level for feature requests
 */
export type FeatureRequestPriority = 'low' | 'medium' | 'high' | 'critical';

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

    // GitHub integration fields
    githubIssueUrl?: string;          // URL to the GitHub issue
    githubIssueNumber?: number;       // GitHub issue number
    githubProjectItemId?: string;     // GitHub Project item ID (for status updates)

    // Approval token for Telegram quick-approve link
    approvalToken?: string;           // Secure token for one-click approval

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
    // GitHub integration fields
    githubIssueUrl?: string;
    githubIssueNumber?: number;
    githubProjectItemId?: string;
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
    startDate?: Date;
    endDate?: Date;
}
