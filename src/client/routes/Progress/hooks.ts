import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query/defaults';
import {
    getActivity,
    getActivitySummary,
    deleteActivity,
    bulkDeleteActivity,
    editActivity,
    duplicateActivity,
} from '@/apis/activity-logs/client';
import type {
    GetActivityResponse,
    GetActivitySummaryResponse,
    DeleteActivityRequest,
    BulkDeleteActivityRequest,
    EditActivityRequest,
    DuplicateActivityRequest,
    ActivityLogEntry,
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

/**
 * Hook for bulk deleting activity records
 *
 * Uses OPTIMISTIC-ONLY pattern for instant UI feedback.
 */
export function useBulkDeleteActivity() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: BulkDeleteActivityRequest) => {
            const response = await bulkDeleteActivity(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.deletedCount;
        },
        // OPTIMISTIC UPDATE: Remove activities immediately
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });
            await queryClient.cancelQueries({ queryKey: ['activity-summary'] });

            const previousQueries = queryClient.getQueriesData({ queryKey: ['activity'] });

            queryClient.setQueriesData<GetActivityResponse>(
                { queryKey: ['activity'] },
                (old) => {
                    if (!old?.activities) return old;
                    const idsToDelete = new Set(variables.activityIds);
                    return {
                        ...old,
                        activities: old.activities.filter((a) => !idsToDelete.has(a._id)),
                    };
                }
            );

            return { previousQueries };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });
}

/**
 * Hook for editing an activity's date
 *
 * Uses OPTIMISTIC-ONLY pattern for instant UI feedback.
 */
export function useEditActivity() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: EditActivityRequest) => {
            const response = await editActivity(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.success;
        },
        // OPTIMISTIC UPDATE: Update activity date immediately
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });
            await queryClient.cancelQueries({ queryKey: ['activity-summary'] });

            const previousQueries = queryClient.getQueriesData({ queryKey: ['activity'] });

            queryClient.setQueriesData<GetActivityResponse>(
                { queryKey: ['activity'] },
                (old) => {
                    if (!old?.activities) return old;
                    return {
                        ...old,
                        activities: old.activities.map((a) =>
                            a._id === variables.activityId
                                ? { ...a, completedAt: variables.completedAt }
                                : a
                        ),
                    };
                }
            );

            return { previousQueries };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            // Refetch to get proper sorted order and update summaries
            queryClient.invalidateQueries({ queryKey: ['activity'] });
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });
}

/**
 * Hook for duplicating an activity
 *
 * Uses OPTIMISTIC-ONLY pattern with refetch for proper data.
 */
export function useDuplicateActivity() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DuplicateActivityRequest) => {
            const response = await duplicateActivity(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.activity;
        },
        // OPTIMISTIC UPDATE: Add duplicated activity immediately
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });
            await queryClient.cancelQueries({ queryKey: ['activity-summary'] });

            const previousQueries = queryClient.getQueriesData<GetActivityResponse>({ queryKey: ['activity'] });

            // Find the original activity to duplicate
            let originalActivity: ActivityLogEntry | undefined;
            previousQueries.forEach(([, data]) => {
                if (data?.activities) {
                    const found = data.activities.find((a) => a._id === variables.activityId);
                    if (found) originalActivity = found;
                }
            });

            if (originalActivity) {
                const tempId = `temp-${Date.now()}`;
                const duplicatedActivity: ActivityLogEntry = {
                    ...originalActivity,
                    _id: tempId,
                    // Use provided date, or fall back to original activity's date (not today's date)
                    completedAt: variables.completedAt || originalActivity.completedAt,
                };

                queryClient.setQueriesData<GetActivityResponse>(
                    { queryKey: ['activity'] },
                    (old) => {
                        if (!old?.activities) return old;
                        return {
                            ...old,
                            activities: [duplicatedActivity, ...old.activities],
                        };
                    }
                );
            }

            return { previousQueries };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            // Refetch to get real ID and proper sorted order
            queryClient.invalidateQueries({ queryKey: ['activity'] });
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });
}


