import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query/defaults';
import { getActivity, getActivitySummary, deleteActivity } from '@/apis/activity-logs/client';
import type {
    GetActivityResponse,
    GetActivitySummaryResponse,
    DeleteActivityRequest,
} from '@/apis/activity-logs/types';

// ============================================================================
// Query Keys
// ============================================================================

export const activityQueryKey = (planId?: string, startDate?: string, endDate?: string) => 
    ['activity', planId ?? 'all', startDate ?? 'none', endDate ?? 'none'] as const;
export const activitySummaryQueryKey = (period: string, planId?: string, startDate?: string, endDate?: string) =>
    ['activity-summary', period, planId ?? 'all', startDate ?? 'none', endDate ?? 'none'] as const;

// ============================================================================
// Query Hooks
// ============================================================================

export function useActivity(options?: {
    planId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    enabled?: boolean;
}) {
    const queryDefaults = useQueryDefaults();
    return useQuery({
        queryKey: activityQueryKey(options?.planId, options?.startDate, options?.endDate),
        queryFn: async (): Promise<GetActivityResponse> => {
            const response = await getActivity({
                planId: options?.planId,
                startDate: options?.startDate,
                endDate: options?.endDate,
                limit: options?.limit ?? 50,
            });
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults,
    });
}

export function useActivitySummary(options?: {
    planId?: string;
    period?: 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
    enabled?: boolean;
}) {
    const queryDefaults = useQueryDefaults();
    const period = options?.period ?? 'day';

    return useQuery({
        queryKey: activitySummaryQueryKey(period, options?.planId, options?.startDate, options?.endDate),
        queryFn: async (): Promise<GetActivitySummaryResponse> => {
            const response = await getActivitySummary({
                planId: options?.planId,
                period,
                startDate: options?.startDate,
                endDate: options?.endDate,
            });
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults,
    });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for deleting an activity record
 * 
 * Uses OPTIMISTIC-ONLY pattern for instant UI feedback.
 */
export function useDeleteActivity() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DeleteActivityRequest) => {
            const response = await deleteActivity(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.success;
        },
        // OPTIMISTIC UPDATE: Remove activity immediately
        onMutate: async (variables) => {
            // Invalidate all activity-related queries
            await queryClient.cancelQueries({ queryKey: ['activity'] });
            await queryClient.cancelQueries({ queryKey: ['activity-summary'] });

            // Store previous data for rollback
            const previousQueries = queryClient.getQueriesData({ queryKey: ['activity'] });

            // Optimistically update all activity queries
            queryClient.setQueriesData<GetActivityResponse>(
                { queryKey: ['activity'] },
                (old) => {
                    if (!old?.activities) return old;
                    return {
                        ...old,
                        activities: old.activities.filter((a) => a._id !== variables.activityId),
                    };
                }
            );

            return { previousQueries };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        // Invalidate summary queries on success since we can't optimistically update aggregations
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });
}


