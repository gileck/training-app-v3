import { callApi, ClientOptions } from './http';

export interface AdminUserSummary {
  id: string;
  username: string;
  email?: string;
  /** ISO-8601 */
  createdAt: string;
  /** True iff this user's _id equals the server's ADMIN_USER_ID env var */
  isAdmin: boolean;
}

export interface AdminUsersListResponse {
  users?: AdminUserSummary[];
  error?: string;
}

/**
 * Admin-only endpoints. Gated server-side on either the on-behalf-of user
 * being the admin, OR the caller holding ADMIN_API_TOKEN — so SDK/MCP
 * callers can always reach these.
 */
export function adminDomain(opts: ClientOptions) {
  return {
    users: {
      /**
       * List every user in the system — used to resolve usernames to user
       * ids when the caller only knows a name.
       */
      list: (): Promise<AdminUsersListResponse> => callApi(opts, 'admin/users/list'),
    },
  };
}
