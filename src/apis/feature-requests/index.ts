/**
 * Feature Requests API Names
 *
 * API name constants for feature request management.
 * These are the single source of truth for API names.
 */

// Legacy name export for eslint compatibility
export const name = 'feature-requests';

// User endpoints
export const API_CREATE_FEATURE_REQUEST = 'feature-requests/create';
export const API_GET_MY_FEATURE_REQUESTS = 'feature-requests/my';
export const API_ADD_USER_COMMENT = 'feature-requests/addComment';

// Admin endpoints
export const API_GET_FEATURE_REQUESTS = 'admin/feature-requests/list';
export const API_GET_FEATURE_REQUEST = 'admin/feature-requests/get';
export const API_UPDATE_FEATURE_REQUEST_STATUS = 'admin/feature-requests/updateStatus';
export const API_UPDATE_DESIGN_REVIEW_STATUS = 'admin/feature-requests/updateDesignReviewStatus';
export const API_UPDATE_DESIGN_CONTENT = 'admin/feature-requests/updateDesignContent';
export const API_ADD_ADMIN_COMMENT = 'admin/feature-requests/addComment';
export const API_UPDATE_ADMIN_NOTES = 'admin/feature-requests/updateAdminNotes';
export const API_UPDATE_PRIORITY = 'admin/feature-requests/updatePriority';
export const API_SET_NEEDS_USER_INPUT = 'admin/feature-requests/setNeedsUserInput';
export const API_DELETE_FEATURE_REQUEST = 'admin/feature-requests/delete';
export const API_APPROVE_FEATURE_REQUEST = 'admin/feature-requests/approve';

// GitHub status endpoints
export const API_GET_GITHUB_STATUS = 'feature-requests/github-status';
export const API_GET_GITHUB_STATUSES = 'feature-requests/github-statuses';
export const API_UPDATE_GITHUB_STATUS = 'admin/feature-requests/update-github-status';
export const API_UPDATE_GITHUB_REVIEW_STATUS = 'admin/feature-requests/update-github-review-status';
export const API_CLEAR_GITHUB_REVIEW_STATUS = 'admin/feature-requests/clear-github-review-status';
export const API_GET_GITHUB_ISSUE_DETAILS = 'feature-requests/github-issue-details';
