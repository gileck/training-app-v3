import type { ApiHandlerContext } from '../../auth/types';
import type {
  GetSessionStatsRequest,
  GetSessionStatsResponse,
  SessionStats,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';
import * as userSessions from '@/server/database/collections/template/user-sessions/userSessions';

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export const getStatsHandler = async (
  _request: GetSessionStatsRequest,
  context: ApiHandlerContext
): Promise<GetSessionStatsResponse> => {
  try {
    if (!context.isAdmin) {
      return { error: 'Admin access required' };
    }

    const todayStart = startOfTodayUtc();
    const weekAgo = daysAgo(7);
    const monthAgo = daysAgo(30);

    const [
      totalUsers,
      visitorsToday,
      visitorsThisWeek,
      visitorsThisMonth,
      sessionsTotal,
      sessionsToday,
      sessionsThisWeek,
    ] = await Promise.all([
      users.countAllUsers(),
      users.countVisitorsSince(todayStart),
      users.countVisitorsSince(weekAgo),
      users.countVisitorsSince(monthAgo),
      userSessions.countAllSessions(),
      userSessions.countSessionsSince(todayStart),
      userSessions.countSessionsSince(weekAgo),
    ]);

    const stats: SessionStats = {
      totalUsers,
      visitorsToday,
      visitorsThisWeek,
      visitorsThisMonth,
      sessionsTotal,
      sessionsToday,
      sessionsThisWeek,
    };

    return { stats };
  } catch (error: unknown) {
    console.error('[admin/sessions/getStats] error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to load session stats',
    };
  }
};
