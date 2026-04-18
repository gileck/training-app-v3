/**
 * User Approvals API Names
 *
 * API name constants for the admin-approved signups feature.
 * All endpoints are admin-only (prefixed with `admin/`).
 */

// Legacy name export for eslint compatibility
export const name = 'user-approvals';

export const API_LIST_PENDING_USERS = 'admin/user-approvals/list';
export const API_APPROVE_USER = 'admin/user-approvals/approve';
export const API_REJECT_USER = 'admin/user-approvals/reject';
