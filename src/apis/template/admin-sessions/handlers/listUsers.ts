import type { ApiHandlerContext } from '../../auth/types';
import type {
  ListSessionUsersRequest,
  ListSessionUsersResponse,
  SessionUserRow,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';
import * as userSessions from '@/server/database/collections/template/user-sessions/userSessions';

export const listUsersHandler = async (
  _request: ListSessionUsersRequest,
  context: ApiHandlerContext
): Promise<ListSessionUsersResponse> => {
  try {
    if (!context.isAdmin) {
      return { error: 'Admin access required' };
    }

    const [allUsers, perUserStats] = await Promise.all([
      users.listAllUsers(),
      userSessions.getPerUserSessionStats(),
    ]);

    // Build a stats lookup keyed by string userId.
    const statsByUserId = new Map<string, { total: number; lastAt?: Date }>();
    for (const stat of perUserStats) {
      statsByUserId.set(stat.userId, { total: stat.total, lastAt: stat.lastAt });
    }

    const rows: SessionUserRow[] = allUsers.map((u) => {
      const id = u._id.toString();
      const stat = statsByUserId.get(id);
      // Prefer user.lastSeenAt (canonical) — fall back to session aggregate if absent
      // (e.g. legacy users seen before lastSeenAt was added).
      const lastSeenAt = u.lastSeenAt ?? stat?.lastAt;
      return {
        userId: id,
        username: u.username,
        lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : undefined,
        sessionsTotal: stat?.total ?? 0,
      };
    });

    // Sort: users with lastSeenAt first (most recent first), then never-seen by username.
    rows.sort((a, b) => {
      if (a.lastSeenAt && b.lastSeenAt) {
        return b.lastSeenAt.localeCompare(a.lastSeenAt);
      }
      if (a.lastSeenAt) return -1;
      if (b.lastSeenAt) return 1;
      return a.username.localeCompare(b.username);
    });

    return { users: rows };
  } catch (error: unknown) {
    console.error('[admin/sessions/listUsers] error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to list session users',
    };
  }
};
