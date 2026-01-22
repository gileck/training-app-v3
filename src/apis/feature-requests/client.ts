import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_CREATE_FEATURE_REQUEST,
    API_GET_MY_FEATURE_REQUESTS,
    API_ADD_USER_COMMENT,
    API_GET_FEATURE_REQUESTS,
    API_GET_FEATURE_REQUEST,
    API_UPDATE_FEATURE_REQUEST_STATUS,
    API_UPDATE_DESIGN_REVIEW_STATUS,
    API_UPDATE_DESIGN_CONTENT,
    API_ADD_ADMIN_COMMENT,
    API_UPDATE_ADMIN_NOTES,
    API_UPDATE_PRIORITY,
    API_SET_NEEDS_USER_INPUT,
    API_DELETE_FEATURE_REQUEST,
    API_APPROVE_FEATURE_REQUEST,
    API_GET_GITHUB_STATUS,
    API_GET_GITHUB_STATUSES,
    API_UPDATE_GITHUB_STATUS,
    API_UPDATE_GITHUB_REVIEW_STATUS,
    API_CLEAR_GITHUB_REVIEW_STATUS,
    API_GET_GITHUB_ISSUE_DETAILS,
} from './index';
import {
    CreateFeatureRequestRequest,
    CreateFeatureRequestResponse,
    GetMyFeatureRequestsRequest,
    GetMyFeatureRequestsResponse,
    AddUserCommentRequest,
    AddUserCommentResponse,
    GetFeatureRequestsRequest,
    GetFeatureRequestsResponse,
    GetFeatureRequestRequest,
    GetFeatureRequestResponse,
    UpdateFeatureRequestStatusRequest,
    UpdateFeatureRequestStatusResponse,
    UpdateDesignReviewStatusRequest,
    UpdateDesignReviewStatusResponse,
    UpdateDesignContentRequest,
    UpdateDesignContentResponse,
    AddAdminCommentRequest,
    AddAdminCommentResponse,
    UpdateAdminNotesRequest,
    UpdateAdminNotesResponse,
    UpdatePriorityRequest,
    UpdatePriorityResponse,
    SetNeedsUserInputRequest,
    SetNeedsUserInputResponse,
    DeleteFeatureRequestRequest,
    DeleteFeatureRequestResponse,
    ApproveFeatureRequestRequest,
    ApproveFeatureRequestResponse,
    GetGitHubStatusRequest,
    GetGitHubStatusResponse,
    GetGitHubStatusesRequest,
    GetGitHubStatusesResponse,
    UpdateGitHubStatusRequest,
    UpdateGitHubStatusResponse,
    UpdateGitHubReviewStatusRequest,
    UpdateGitHubReviewStatusResponse,
    ClearGitHubReviewStatusRequest,
    ClearGitHubReviewStatusResponse,
    GetGitHubIssueDetailsRequest,
    GetGitHubIssueDetailsResponse,
} from './types';

// ============================================================
// User Endpoints
// ============================================================

/**
 * Create a new feature request
 */
export const createFeatureRequest = async (
    params: CreateFeatureRequestRequest
): Promise<CacheResult<CreateFeatureRequestResponse>> => {
    return apiClient.post(API_CREATE_FEATURE_REQUEST, params);
};

/**
 * Get current user's feature requests
 */
export const getMyFeatureRequests = async (
    params: GetMyFeatureRequestsRequest = {}
): Promise<CacheResult<GetMyFeatureRequestsResponse>> => {
    return apiClient.call(API_GET_MY_FEATURE_REQUESTS, params);
};

/**
 * Add a comment to a feature request (as user)
 */
export const addUserComment = async (
    params: AddUserCommentRequest
): Promise<CacheResult<AddUserCommentResponse>> => {
    return apiClient.post(API_ADD_USER_COMMENT, params);
};

// ============================================================
// Admin Endpoints
// ============================================================

/**
 * Get all feature requests (admin only)
 */
export const getFeatureRequests = async (
    params: GetFeatureRequestsRequest = {}
): Promise<CacheResult<GetFeatureRequestsResponse>> => {
    return apiClient.call(API_GET_FEATURE_REQUESTS, params);
};

/**
 * Get a single feature request by ID (admin only)
 */
export const getFeatureRequest = async (
    params: GetFeatureRequestRequest
): Promise<CacheResult<GetFeatureRequestResponse>> => {
    return apiClient.call(API_GET_FEATURE_REQUEST, params);
};

/**
 * Update feature request status (admin only)
 */
export const updateFeatureRequestStatus = async (
    params: UpdateFeatureRequestStatusRequest
): Promise<CacheResult<UpdateFeatureRequestStatusResponse>> => {
    return apiClient.post(API_UPDATE_FEATURE_REQUEST_STATUS, params);
};

/**
 * Update design review status - approve/reject (admin only)
 */
export const updateDesignReviewStatus = async (
    params: UpdateDesignReviewStatusRequest
): Promise<CacheResult<UpdateDesignReviewStatusResponse>> => {
    return apiClient.post(API_UPDATE_DESIGN_REVIEW_STATUS, params);
};

/**
 * Update design content (admin/agent only)
 */
export const updateDesignContent = async (
    params: UpdateDesignContentRequest
): Promise<CacheResult<UpdateDesignContentResponse>> => {
    return apiClient.post(API_UPDATE_DESIGN_CONTENT, params);
};

/**
 * Add a comment to a feature request (as admin)
 */
export const addAdminComment = async (
    params: AddAdminCommentRequest
): Promise<CacheResult<AddAdminCommentResponse>> => {
    return apiClient.post(API_ADD_ADMIN_COMMENT, params);
};

/**
 * Update admin notes (admin only)
 */
export const updateAdminNotes = async (
    params: UpdateAdminNotesRequest
): Promise<CacheResult<UpdateAdminNotesResponse>> => {
    return apiClient.post(API_UPDATE_ADMIN_NOTES, params);
};

/**
 * Update priority (admin only)
 */
export const updatePriority = async (
    params: UpdatePriorityRequest
): Promise<CacheResult<UpdatePriorityResponse>> => {
    return apiClient.post(API_UPDATE_PRIORITY, params);
};

/**
 * Set needs user input flag (admin only)
 */
export const setNeedsUserInput = async (
    params: SetNeedsUserInputRequest
): Promise<CacheResult<SetNeedsUserInputResponse>> => {
    return apiClient.post(API_SET_NEEDS_USER_INPUT, params);
};

/**
 * Delete a feature request (admin only)
 */
export const deleteFeatureRequest = async (
    params: DeleteFeatureRequestRequest
): Promise<CacheResult<DeleteFeatureRequestResponse>> => {
    return apiClient.post(API_DELETE_FEATURE_REQUEST, params);
};

/**
 * Approve a feature request and create GitHub issue (admin only)
 */
export const approveFeatureRequest = async (
    params: ApproveFeatureRequestRequest
): Promise<CacheResult<ApproveFeatureRequestResponse>> => {
    return apiClient.post(API_APPROVE_FEATURE_REQUEST, params);
};

// ============================================================
// GitHub Status Endpoint
// ============================================================

/**
 * Get GitHub Project status for a feature request
 * Users can view status of their own requests, admins can view any
 */
export const getGitHubStatus = async (
    params: GetGitHubStatusRequest
): Promise<CacheResult<GetGitHubStatusResponse>> => {
    return apiClient.call(API_GET_GITHUB_STATUS, params);
};

/**
 * Get available GitHub Project statuses
 */
export const getGitHubStatuses = async (
    params: GetGitHubStatusesRequest = {}
): Promise<CacheResult<GetGitHubStatusesResponse>> => {
    return apiClient.call(API_GET_GITHUB_STATUSES, params);
};

/**
 * Update GitHub Project status for a feature request (admin only)
 */
export const updateGitHubStatus = async (
    params: UpdateGitHubStatusRequest
): Promise<CacheResult<UpdateGitHubStatusResponse>> => {
    return apiClient.post(API_UPDATE_GITHUB_STATUS, params);
};

/**
 * Update GitHub Project review status for a feature request (admin only)
 */
export const updateGitHubReviewStatus = async (
    params: UpdateGitHubReviewStatusRequest
): Promise<CacheResult<UpdateGitHubReviewStatusResponse>> => {
    return apiClient.post(API_UPDATE_GITHUB_REVIEW_STATUS, params);
};

/**
 * Clear GitHub Project review status for a feature request (admin only)
 * This sets the field to empty/null, making it ready for agent processing
 */
export const clearGitHubReviewStatus = async (
    params: ClearGitHubReviewStatusRequest
): Promise<CacheResult<ClearGitHubReviewStatusResponse>> => {
    return apiClient.post(API_CLEAR_GITHUB_REVIEW_STATUS, params);
};

/**
 * Get GitHub issue details including full description and linked PRs
 * Users can view their own requests, admins can view any
 */
export const getGitHubIssueDetails = async (
    params: GetGitHubIssueDetailsRequest
): Promise<CacheResult<GetGitHubIssueDetailsResponse>> => {
    return apiClient.call(API_GET_GITHUB_ISSUE_DETAILS, params);
};
