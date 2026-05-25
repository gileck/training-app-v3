/**
 * Domain types for the admin user-session tracking API.
 */

export interface SessionStats {
  totalUsers: number;
  visitorsToday: number;
  visitorsThisWeek: number;
  visitorsThisMonth: number;
  sessionsTotal: number;
  sessionsToday: number;
  sessionsThisWeek: number;
}

export interface SessionUserRow {
  userId: string;
  username: string;
  /** ISO date string. Undefined for users who have never been seen. */
  lastSeenAt?: string;
  sessionsTotal: number;
}

// ============================================================
// Get global stats
// ============================================================

export type GetSessionStatsRequest = Record<string, never>;

export interface GetSessionStatsResponse {
  stats?: SessionStats;
  error?: string;
}

// ============================================================
// List per-user rows
// ============================================================

export type ListSessionUsersRequest = Record<string, never>;

export interface ListSessionUsersResponse {
  users?: SessionUserRow[];
  error?: string;
}
