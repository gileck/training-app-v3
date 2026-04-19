export interface AdminUserSummary {
  id: string;
  username: string;
  email?: string;
  /** ISO-8601 */
  createdAt: string;
  /** True iff this user's _id equals ADMIN_USER_ID */
  isAdmin: boolean;
}

export interface AdminUsersListResponse {
  users?: AdminUserSummary[];
  error?: string;
}
