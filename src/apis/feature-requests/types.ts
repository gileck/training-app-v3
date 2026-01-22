import {
    FeatureRequestClient,
    FeatureRequestStatus,
    FeatureRequestPriority,
    DesignReviewStatus,
    DesignPhaseType,
    DesignPhaseClient,
    FeatureRequestCommentClient,
} from '@/server/database/collections/feature-requests/types';

// ============================================================
// User Endpoints
// ============================================================

// Create feature request
export interface CreateFeatureRequestRequest {
    title: string;
    description: string;
    page?: string;
}

export interface CreateFeatureRequestResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// Get my feature requests
export type GetMyFeatureRequestsRequest = Record<string, never>;

export interface GetMyFeatureRequestsResponse {
    featureRequests?: FeatureRequestClient[];
    error?: string;
}

// Add user comment
export interface AddUserCommentRequest {
    requestId: string;
    content: string;
}

export interface AddUserCommentResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// ============================================================
// Admin Endpoints
// ============================================================

// Get all feature requests (admin)
export interface GetFeatureRequestsRequest {
    status?: FeatureRequestStatus;
    priority?: FeatureRequestPriority;
    startDate?: string; // ISO string
    endDate?: string; // ISO string
    sortBy?: 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
}

export interface GetFeatureRequestsResponse {
    featureRequests?: FeatureRequestClient[];
    error?: string;
}

// Get single feature request (admin)
export interface GetFeatureRequestRequest {
    requestId: string;
}

export interface GetFeatureRequestResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// Update feature request status
export interface UpdateFeatureRequestStatusRequest {
    requestId: string;
    status: FeatureRequestStatus;
}

export interface UpdateFeatureRequestStatusResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// Update design review status (approve/reject)
export interface UpdateDesignReviewStatusRequest {
    requestId: string;
    phase: DesignPhaseType;
    reviewStatus: DesignReviewStatus;
    adminComments?: string;
}

export interface UpdateDesignReviewStatusResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// Update design content (used by agent)
export interface UpdateDesignContentRequest {
    requestId: string;
    phase: DesignPhaseType;
    content: string;
    reviewStatus?: DesignReviewStatus;
}

export interface UpdateDesignContentResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// Add admin comment
export interface AddAdminCommentRequest {
    requestId: string;
    content: string;
}

export interface AddAdminCommentResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// Update admin notes
export interface UpdateAdminNotesRequest {
    requestId: string;
    adminNotes: string;
}

export interface UpdateAdminNotesResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// Update priority
export interface UpdatePriorityRequest {
    requestId: string;
    priority: FeatureRequestPriority;
}

export interface UpdatePriorityResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// Set needs user input flag
export interface SetNeedsUserInputRequest {
    requestId: string;
    needsUserInput: boolean;
}

export interface SetNeedsUserInputResponse {
    featureRequest?: FeatureRequestClient;
    error?: string;
}

// Delete feature request
export interface DeleteFeatureRequestRequest {
    requestId: string;
}

export interface DeleteFeatureRequestResponse {
    success?: boolean;
    error?: string;
}

// Approve feature request (creates GitHub issue)
export interface ApproveFeatureRequestRequest {
    requestId: string;
}

export interface ApproveFeatureRequestResponse {
    featureRequest?: FeatureRequestClient;
    githubIssueUrl?: string;
    githubIssueNumber?: number;
    error?: string;
}

// Get GitHub Project status
export interface GetGitHubStatusRequest {
    requestId: string;
}

export interface GetGitHubStatusResponse {
    status?: string | null;
    reviewStatus?: string | null;
    issueState?: 'OPEN' | 'CLOSED' | null;
    issueUrl?: string;
    error?: string;
}

// Get available GitHub statuses
export type GetGitHubStatusesRequest = Record<string, never>;

export interface GetGitHubStatusesResponse {
    statuses?: string[];
    reviewStatuses?: string[];
    error?: string;
}

// Update GitHub Project status
export interface UpdateGitHubStatusRequest {
    requestId: string;
    status: string;
}

export interface UpdateGitHubStatusResponse {
    success?: boolean;
    error?: string;
}

// Update GitHub Project review status
export interface UpdateGitHubReviewStatusRequest {
    requestId: string;
    reviewStatus: string;
}

export interface UpdateGitHubReviewStatusResponse {
    success?: boolean;
    error?: string;
}

// Clear GitHub Project review status
export interface ClearGitHubReviewStatusRequest {
    requestId: string;
}

export interface ClearGitHubReviewStatusResponse {
    success?: boolean;
    error?: string;
}

// Get GitHub Issue Details
export interface GetGitHubIssueDetailsRequest {
    requestId: string;
}

export interface LinkedPullRequest {
    number: number;
    url: string;
    title: string;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
    mergedAt?: string;
}

export interface GitHubIssueDetails {
    number: number;
    title: string;
    body: string;
    url: string;
    state: 'OPEN' | 'CLOSED';
    linkedPullRequests: LinkedPullRequest[];
}

export interface GetGitHubIssueDetailsResponse {
    issueDetails?: GitHubIssueDetails;
    error?: string;
}

// Re-export types for convenience
export type {
    FeatureRequestClient,
    FeatureRequestStatus,
    FeatureRequestPriority,
    DesignReviewStatus,
    DesignPhaseType,
    DesignPhaseClient,
    FeatureRequestCommentClient,
};
