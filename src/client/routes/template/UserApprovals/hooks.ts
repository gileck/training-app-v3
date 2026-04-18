/**
 * User Approvals Route Hooks
 *
 * React Query hooks for the admin-approved signups page.
 * Mutations follow the optimistic-only pattern:
 *   - update cache in onMutate
 *   - rollback in onError
 *   - empty onSuccess / onSettled
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPendingUsers,
  approveUser,
  rejectUser,
} from '@/apis/template/user-approvals/client';
import type { PendingUser } from '@/apis/template/user-approvals/types';
import { useQueryDefaults } from '@/client/query';
import { toast } from '@/client/components/template/ui/toast';

const pendingUsersQueryKey = ['user-approvals', 'pending'] as const;

export function usePendingUsers() {
  const queryDefaults = useQueryDefaults();

  return useQuery({
    queryKey: pendingUsersQueryKey,
    queryFn: async (): Promise<PendingUser[]> => {
      const result = await listPendingUsers();
      if (result.data?.error) {
        throw new Error(result.data.error);
      }
      return result.data?.users ?? [];
    },
    ...queryDefaults,
  });
}

export function useApproveUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await approveUser({ userId });
      if (result.data?.error) {
        throw new Error(result.data.error);
      }
      return result.data;
    },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: pendingUsersQueryKey });
      const previous = queryClient.getQueryData<PendingUser[]>(pendingUsersQueryKey);

      queryClient.setQueryData<PendingUser[]>(pendingUsersQueryKey, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((u) => u.id !== userId);
      });

      return { previous };
    },
    onError: (_err, _userId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(pendingUsersQueryKey, context.previous);
      }
      toast.error('Failed to approve user');
    },
    // Toast is UI feedback only — does not violate optimistic-only pattern.
    onSuccess: () => {
      toast.success('User approved');
    },
    onSettled: () => {},
  });
}

export function useRejectUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await rejectUser({ userId });
      if (result.data?.error) {
        throw new Error(result.data.error);
      }
      return result.data;
    },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: pendingUsersQueryKey });
      const previous = queryClient.getQueryData<PendingUser[]>(pendingUsersQueryKey);

      queryClient.setQueryData<PendingUser[]>(pendingUsersQueryKey, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((u) => u.id !== userId);
      });

      return { previous };
    },
    onError: (_err, _userId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(pendingUsersQueryKey, context.previous);
      }
      toast.error('Failed to reject user');
    },
    onSuccess: () => {
      toast.success('User rejected');
    },
    onSettled: () => {},
  });
}
