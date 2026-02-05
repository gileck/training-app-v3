/**
 * Home route hooks
 * 
 * Activity log hooks for +1/-1 set tracking
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addActivity, deleteActivity, getActivity } from '@/apis/project/activity-logs/client';
import type { AddActivityRequest, GetActivityResponse } from '@/apis/project/activity-logs/types';
import { generateId } from '@/client/utils/id';

// ============================================================================
// Activity Log Hooks
// ============================================================================

/**
 * Hook for adding an activity log when user completes a set
 */
export function useAddActivity() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data: AddActivityRequest & { activityIds: string[] }) => {
            const response = await addActivity({
                ...data,
                activityIds: data.activityIds,
            });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // Optimistic update for activity logs
        onMutate: async (_variables) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });
            // Note: We don't do full optimistic update here because activity logs
            // are secondary to the main progress - the store handles the primary state
        },
        // Invalidate summary on success/settle (aggregations need server data)
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });

    return {
        ...mutation,
        mutate: (
            data: Omit<AddActivityRequest, 'activityIds'>,
            options?: Parameters<typeof mutation.mutate>[1]
        ) => {
            // Generate IDs for each set
            const activityIds = Array.from(
                { length: data.numberOfSets },
                () => generateId()
            );
            return mutation.mutate({ ...data, activityIds }, options);
        },
    };
}

/**
 * Hook for deleting the most recent activity log when user removes a set
 * Fails silently if no activity is found (as per plan)
 */
export function useDeleteRecentActivity() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { planExerciseId: string; date: string }) => {
            // First, get recent activity for this exercise on this date
            const response = await getActivity({
                startDate: data.date,
                endDate: data.date,
                limit: 100,
            });

            if (response.data?.error) {
                // Silent ignore
                return { success: false };
            }

            // Find most recent activity for this exercise
            const activities = response.data?.activities || [];
            const recentActivity = activities.find(
                (a) => a.planExerciseId === data.planExerciseId
            );

            if (!recentActivity) {
                // No activity found - silent ignore as per plan
                return { success: false };
            }

            // Delete the most recent activity
            const deleteResponse = await deleteActivity({
                activityId: recentActivity._id,
            });

            if (deleteResponse.data?.error) {
                // Silent ignore
                return { success: false };
            }

            return { success: true };
        },
        // Optimistic removal from cache
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });

            const previousQueries = queryClient.getQueriesData({ queryKey: ['activity'] });

            // Optimistically remove the most recent matching activity
            queryClient.setQueriesData<GetActivityResponse>(
                { queryKey: ['activity'] },
                (old) => {
                    if (!old?.activities) return old;
                    const activities = [...old.activities];
                    const index = activities.findIndex(
                        (a) => a.planExerciseId === variables.planExerciseId
                    );
                    if (index !== -1) {
                        activities.splice(index, 1);
                    }
                    return { ...old, activities };
                }
            );

            return { previousQueries };
        },
        onError: (_err, _variables, _context) => {
            // Silent error - don't rollback since this is secondary to the main state
            // The set count in the store is the source of truth
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}
