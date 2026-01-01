/**
 * Progress route hooks
 * 
 * ============================================================================
 * OPTIMISTIC-ONLY UI PATTERN (CRITICAL - READ CAREFULLY)
 * ============================================================================
 * 
 * All mutations use OPTIMISTIC UPDATES for instant UI feedback.
 * 
 * **RULE: NEVER update UI from server responses on SUCCESS.**
 * 
 * Why? Race conditions:
 *   1. User creates activity → UI shows new activity (optimistic)
 *   2. User deletes it quickly → UI removes activity (optimistic)
 *   3. Server response for create arrives → UI would re-add deleted item (WRONG!)
 * 
 * Solution:
 *   - `onMutate`: Update UI immediately (this IS the source of truth)
 *   - `onSuccess`: Do NOT call invalidateQueries or setQueryData
 *   - `onError`: ONLY on error - rollback to previous state
 *   - `onSettled`: Only invalidate summary (aggregations can't be optimistic)
 * ============================================================================
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query/defaults';
import {
    getActivity,
    getActivitySummary,
    deleteActivity,
    bulkDeleteActivity,
    editActivity,
    duplicateActivity,
    addActivity,
} from '@/apis/activity-logs/client';
import type {
    GetActivityResponse,
    GetActivitySummaryResponse,
    DeleteActivityRequest,
    BulkDeleteActivityRequest,
    EditActivityRequest,
    DuplicateActivityRequest,
    AddActivityRequest,
    ActivityLogEntry,
} from '@/apis/activity-logs/types';
import { generateId } from '@/client/utils/id';

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
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI removes item immediately in onMutate
 * - Server response is IGNORED on success
 * - Only on ERROR do we rollback to previous state
 * - Summary invalidation kept (aggregations can't be optimistic)
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
        // OPTIMISTIC UPDATE: Remove activity immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });

            const previousQueries = queryClient.getQueriesData({ queryKey: ['activity'] });

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
        // Summary needs refresh (aggregations can't be optimistic)
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });
}

/**
 * Hook for bulk deleting activity records
 *
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI removes items immediately in onMutate
 * - Server response is IGNORED on success
 * - Only on ERROR do we rollback to previous state
 * - Summary invalidation kept (aggregations can't be optimistic)
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
        // OPTIMISTIC UPDATE: Remove activities immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });

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
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        // Summary needs refresh (aggregations can't be optimistic)
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });
}

/**
 * Hook for editing an activity's date
 *
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates item immediately in onMutate
 * - Server response is IGNORED on success
 * - Only on ERROR do we rollback to previous state
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
        // OPTIMISTIC UPDATE: Update activity date immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });

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
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        // Summary needs refresh (date changes affect aggregations)
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });
}

/**
 * Hook for duplicating an activity
 *
 * Uses OPTIMISTIC-ONLY pattern with client-generated UUID:
 * - Client generates stable UUID that server persists
 * - UI updates immediately in onMutate
 * - Server response is IGNORED on success
 * - Only on ERROR do we rollback to previous state
 * - Idempotent: retries with same ID won't create duplicates
 */
export function useDuplicateActivity() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data: DuplicateActivityRequest & { _id: string }) => {
            const response = await duplicateActivity(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.activity;
        },
        // OPTIMISTIC UPDATE: Add duplicated activity immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables: DuplicateActivityRequest & { _id: string }) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });

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
                const duplicatedActivity: ActivityLogEntry = {
                    ...originalActivity,
                    _id: variables._id,
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
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        // Summary needs refresh (new activity affects aggregations)
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });

    // Wrap mutate to inject client-generated ID
    return {
        ...mutation,
        mutate: (data: DuplicateActivityRequest, options?: Parameters<typeof mutation.mutate>[1]) => {
            return mutation.mutate({ ...data, _id: generateId() }, options);
        },
        mutateAsync: async (data: DuplicateActivityRequest, options?: Parameters<typeof mutation.mutateAsync>[1]) => {
            return mutation.mutateAsync({ ...data, _id: generateId() }, options);
        },
    };
}

/**
 * Hook for adding new activities (creating set logs)
 *
 * Uses OPTIMISTIC-ONLY pattern with client-generated UUIDs:
 * - Client generates stable UUIDs for each set that server persists
 * - UI updates immediately in onMutate
 * - Server response is IGNORED on success
 * - Only on ERROR do we rollback to previous state
 * - Idempotent: retries with same IDs won't create duplicates
 */
export function useAddActivity() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data: AddActivityRequest & { activityIds: string[] }) => {
            const response = await addActivity(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.activities;
        },
        // OPTIMISTIC UPDATE: Add activities immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables: AddActivityRequest & { activityIds: string[] }) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });

            const previousQueries = queryClient.getQueriesData<GetActivityResponse>({ queryKey: ['activity'] });

            // Create activities with client-generated UUIDs
            const newActivities: ActivityLogEntry[] = [];
            for (let i = 0; i < variables.numberOfSets; i++) {
                newActivities.push({
                    _id: variables.activityIds[i],
                    userId: '',
                    planExerciseId: variables.planExerciseId,
                    planId: '',
                    weekNumber: 1,
                    setNumber: i + 1,
                    completedAt: variables.completedAt,
                    exerciseName: 'Loading...',
                    exerciseImageUrl: '',
                    primaryMuscle: '',
                    planName: '',
                });
            }

            queryClient.setQueriesData<GetActivityResponse>(
                { queryKey: ['activity'] },
                (old) => {
                    if (!old?.activities) return old;
                    return {
                        ...old,
                        activities: [...newActivities, ...old.activities],
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
        // Summary needs refresh (new activities affect aggregations)
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });

    // Wrap mutate to inject client-generated IDs
    return {
        ...mutation,
        mutate: (data: AddActivityRequest, options?: Parameters<typeof mutation.mutate>[1]) => {
            const activityIds = Array.from({ length: data.numberOfSets }, () => generateId());
            return mutation.mutate({ ...data, activityIds }, options);
        },
        mutateAsync: async (data: AddActivityRequest, options?: Parameters<typeof mutation.mutateAsync>[1]) => {
            const activityIds = Array.from({ length: data.numberOfSets }, () => generateId());
            return mutation.mutateAsync({ ...data, activityIds }, options);
        },
    };
}
