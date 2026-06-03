export interface AdminUserSummary {
  id: string;
  username: string;
  email?: string;
  /** ISO-8601 */
  createdAt: string;
  /** True iff this user's _id equals ADMIN_USER_ID */
  isAdmin: boolean;
  /** Missing = 'approved' (legacy users) */
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  /** Number of passkeys this user has registered. */
  passkeyCount?: number;
}

export interface AdminUsersListResponse {
  users?: AdminUserSummary[];
  error?: string;
}

/** `admin/users/generate-passkey-link` — mint a one-time passkey-enroll URL. */
export interface GeneratePasskeyLinkRequest {
  userId: string;
}

export interface GeneratePasskeyLinkResponse {
  /** Absolute enrollment URL to hand to the user (same link email would send). */
  url?: string;
  /** ISO-8601 expiry of the link. */
  expiresAt?: string;
  error?: string;
}
