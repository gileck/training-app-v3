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

import { useMemo } from 'react';
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
} from '@/apis/project/activity-logs/client';
import type {
    GetActivityResponse,
    GetActivitySummaryResponse,
    DeleteActivityRequest,
    BulkDeleteActivityRequest,
    EditActivityRequest,
    DuplicateActivityRequest,
    AddActivityRequest,
    ActivityLogEntry,
} from '@/apis/project/activity-logs/types';
import { generateId } from '@/client/utils/id';
import { calculateRecoveryScore, type RecoveryScoreResult } from './utils/recoveryScore';

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query keys use relative period (e.g., '7days') instead of actual dates.
 * This enables cache hits across days - yesterday's cached data is shown instantly
 * while fresh data loads in background (stale-while-revalidate pattern).
 */
export const activityQueryKey = (period: string, planId?: string) =>
    ['activity', period, planId ?? 'all'] as const;
export const activitySummaryQueryKey = (aggregation: string, period: string, planId?: string) =>
    ['activity-summary', aggregation, period, planId ?? 'all'] as const;

// ============================================================================
// Date Range Helper
// ============================================================================

type DateRangePeriod = '7days' | '14days' | '30days' | '90days' | 'all';

/**
 * Convert relative period to actual date range for API requests.
 * Dates are computed at query time, not cached in the key.
 */
function getDateRangeFromPeriod(period: DateRangePeriod): { startDate?: string; endDate?: string } {
    if (period === 'all') return {};

    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
        case '7days':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case '14days':
            startDate.setDate(startDate.getDate() - 14);
            break;
        case '30days':
            startDate.setDate(startDate.getDate() - 30);
            break;
        case '90days':
            startDate.setDate(startDate.getDate() - 90);
            break;
    }

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    };
}

// ============================================================================
// Query Hooks
// ============================================================================

export function useActivity(options?: {
    planId?: string;
    /** Relative period like '7days', '30days'. Used in cache key for cross-day cache hits. */
    period?: DateRangePeriod;
    limit?: number;
    enabled?: boolean;
}) {
    const queryDefaults = useQueryDefaults();
    const period = options?.period ?? '30days';

    return useQuery({
        queryKey: activityQueryKey(period, options?.planId),
        queryFn: async (): Promise<GetActivityResponse> => {
            // Compute actual dates at query time
            const { startDate, endDate } = getDateRangeFromPeriod(period);
            const response = await getActivity({
                planId: options?.planId,
                startDate,
                endDate,
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
    /** Aggregation period for grouping data: day, week, or month */
    aggregation?: 'day' | 'week' | 'month';
    /** Relative period like '7days', '30days'. Used in cache key for cross-day cache hits. */
    period?: DateRangePeriod;
    enabled?: boolean;
}) {
    const queryDefaults = useQueryDefaults();
    const aggregation = options?.aggregation ?? 'day';
    const period = options?.period ?? '30days';

    return useQuery({
        queryKey: activitySummaryQueryKey(aggregation, period, options?.planId),
        queryFn: async (): Promise<GetActivitySummaryResponse> => {
            // Compute actual dates at query time
            const { startDate, endDate } = getDateRangeFromPeriod(period);
            const response = await getActivitySummary({
                planId: options?.planId,
                period: aggregation,
                startDate,
                endDate,
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
                    weekNumber: variables.weekNumber ?? 1, // Use provided week number, default to 1
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

// ============================================================================
// Recovery Score Hook
// ============================================================================

/**
 * Hook for calculating recovery score based on recent activity
 *
 * Uses the activity summary data (last 30 days) to calculate a weighted
 * recovery score. Recent days are weighted more heavily than older days.
 *
 * @returns Recovery score result with score, label, color, and daily breakdown
 */
export function useRecoveryScore(): {
    data: RecoveryScoreResult | undefined;
    isLoading: boolean;
} {
    // Fetch 30 days of data for both baseline calculation and lookback
    const { data: summaryData, isLoading } = useActivitySummary({
        aggregation: 'day',
        period: '30days',
    });

    const data = useMemo(() => {
        if (!summaryData?.summaries) return undefined;
        return calculateRecoveryScore(summaryData.summaries);
    }, [summaryData?.summaries]);

    return { data, isLoading };
}
