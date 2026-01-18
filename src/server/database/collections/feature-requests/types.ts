import { ObjectId } from 'mongodb';

/**
 * Main workflow status for a feature request
 */
export type FeatureRequestStatus =
    | 'new'              // Just submitted, not yet reviewed
    | 'in_review'        // Admin is reviewing the request
    | 'product_design'   // In product design phase
    | 'tech_design'      // In technical design phase
    | 'ready_for_dev'    // Design complete, ready for development
    | 'in_development'   // Being built
    | 'ready_for_qa'     // Development complete, testing needed
    | 'done'             // Shipped
    | 'rejected'         // Not going to do
    | 'on_hold';         // Paused for later

/**
 * Review status within a design phase
 */
export type DesignReviewStatus =
    | 'not_started'      // Agent hasn't worked on it yet
    | 'in_progress'      // Agent is currently generating
    | 'pending_review'   // Waiting for admin approval
    | 'approved'         // Admin approved, can move to next phase
    | 'rejected';        // Admin rejected, agent can rework

/**
 * Priority level for feature requests
 */
export type FeatureRequestPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Design phase tracking (used for both product and tech design)
 */
export interface DesignPhase {
    content: string;                  // The design document (markdown)
    reviewStatus: DesignReviewStatus;
    adminComments?: string;           // Feedback when rejected
    iterations: number;               // How many times reworked
    generatedAt?: Date;
    approvedAt?: Date;
}

/**
 * Client-friendly design phase with string dates
 */
export interface DesignPhaseClient {
    content: string;
    reviewStatus: DesignReviewStatus;
    adminComments?: string;
    iterations: number;
    generatedAt?: string;
    approvedAt?: string;
}

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

    // Design phases with review workflow
    productDesign?: DesignPhase;
    techDesign?: DesignPhase;

    // User interaction
    needsUserInput: boolean;          // True when admin needs more info from user
    requestedBy: ObjectId;            // User who submitted
    comments: FeatureRequestComment[];

    // Admin-only fields
    adminNotes?: string;              // Internal notes (not shown to user)
    priority?: FeatureRequestPriority;

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
    productDesign?: DesignPhaseClient;
    techDesign?: DesignPhaseClient;
    needsUserInput: boolean;
    requestedBy: string;
    comments: FeatureRequestCommentClient[];
    adminNotes?: string;
    priority?: FeatureRequestPriority;
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

/**
 * Design phase type identifier
 */
export type DesignPhaseType = 'product' | 'tech';
