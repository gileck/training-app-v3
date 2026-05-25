/**
 * Admin Sessions Route Hooks
 *
 * Read-only admin page — query hooks only, no mutations.
 */

import { useQuery } from '@tanstack/react-query';
import {
  getSessionStats,
  listSessionUsers,
} from '@/apis/template/admin-sessions/client';
import type {
  SessionStats,
  SessionUserRow,
} from '@/apis/template/admin-sessions/types';
import { useQueryDefaults } from '@/client/query';

const sessionStatsQueryKey = ['admin-sessions', 'stats'] as const;
const sessionUsersQueryKey = ['admin-sessions', 'users'] as const;

export function useSessionStats() {
  const queryDefaults = useQueryDefaults();

  return useQuery({
    queryKey: sessionStatsQueryKey,
    queryFn: async (): Promise<SessionStats> => {
      const result = await getSessionStats();
      if (result.data?.error) {
        throw new Error(result.data.error);
      }
      if (!result.data?.stats) {
        throw new Error('Stats unavailable');
      }
      return result.data.stats;
    },
    ...queryDefaults,
  });
}

export function useSessionUsers() {
  const queryDefaults = useQueryDefaults();

  return useQuery({
    queryKey: sessionUsersQueryKey,
    queryFn: async (): Promise<SessionUserRow[]> => {
      const result = await listSessionUsers();
      if (result.data?.error) {
        throw new Error(result.data.error);
      }
      return result.data?.users ?? [];
    },
    ...queryDefaults,
  });
}
