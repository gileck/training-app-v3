/**
 * Domain types for the admin user-approvals API.
 * Used by the /admin/approvals page to list and act on pending signups.
 */

/** Sanitized view of a pending user for the admin UI. */
export interface PendingUser {
  id: string;
  username: string;
  email?: string;
  /** ISO date string */
  createdAt: string;
}

// ============================================================
// List pending users
// ============================================================

export type ListPendingUsersRequest = Record<string, never>;

export interface ListPendingUsersResponse {
  users?: PendingUser[];
  error?: string;
}

// ============================================================
// Approve user
// ============================================================

export interface ApproveUserRequest {
  userId: string;
}

export interface ApproveUserResponse {
  success?: boolean;
  error?: string;
}

// ============================================================
// Reject user (soft delete — sets approvalStatus to 'rejected')
// ============================================================

export interface RejectUserRequest {
  userId: string;
}

export interface RejectUserResponse {
  success?: boolean;
  error?: string;
}
