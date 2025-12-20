/**
 * Workout feature hooks
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
 *   1. User clicks [+] → UI shows 1 (optimistic)
 *   2. User clicks [+] again → UI shows 2 (optimistic)
 *   3. Server response for click 1 arrives → UI would revert to 1 (WRONG!)
 * 
 * Solution:
 *   - `onMutate`: Update UI immediately (this IS the source of truth)
 *   - `onSuccess`: Do NOT call invalidateQueries or setQueryData
 *   - `onError`: ONLY on error - rollback to previous state
 *   - `onSettled`: NEVER refetch - optimistic state is already correct
 * 
 * The app works offline - mutations are queued and synced when online.
 * Server responses are only used to detect errors, not to update UI.
 * ============================================================================
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query/defaults';
import { getWeekProgress, updateSets } from '@/apis/weekly-progress/client';
import { listPlans } from '@/apis/training-plans/client';
import { useWorkoutStore, useActivePlanId } from './store';
import type { GetWeekProgressResponse, UpdateSetsRequest, ExerciseWeekProgress } from '@/apis/weekly-progress/types';
import type { ListPlansResponse } from '@/apis/training-plans/types';

// ============================================================================
// Query Keys
// ============================================================================

export const plansQueryKey = ['training-plans'] as const;
export const weekProgressQueryKey = (planId: string, weekNumber: number) =>
    ['week-progress', planId, weekNumber] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all plans for current user
 */
export function usePlans(options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: plansQueryKey,
        queryFn: async (): Promise<ListPlansResponse> => {
            const response = await listPlans({});
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults,
    });
}

/**
 * Hook to fetch week progress for current plan/week
 */
export function useWeekProgress(planId: string | null, weekNumber: number) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: weekProgressQueryKey(planId || '', weekNumber),
        queryFn: async (): Promise<GetWeekProgressResponse> => {
            if (!planId) throw new Error('No plan selected');
            const response = await getWeekProgress({ planId, weekNumber });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: !!planId && weekNumber >= 1,
        ...queryDefaults,
    });
}

/**
 * Hook to update sets (add/remove/complete-all)
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useUpdateSets() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateSetsRequest) => {
            const response = await updateSets(data);
            // Don't throw on offline - mutation is queued
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // OPTIMISTIC UPDATE: Update UI immediately before server responds
        onMutate: async (variables) => {
            // Cancel any outgoing refetches to prevent race conditions
            await queryClient.cancelQueries({
                queryKey: weekProgressQueryKey(variables.planId, variables.weekNumber),
            });

            // Snapshot the previous value for rollback on error
            const previousData = queryClient.getQueryData<GetWeekProgressResponse>(
                weekProgressQueryKey(variables.planId, variables.weekNumber)
            );

            // Optimistically update the cache - THIS IS THE SOURCE OF TRUTH
            if (previousData?.exercises) {
                const newExercises = previousData.exercises.map((exercise: ExerciseWeekProgress) => {
                    if (exercise.planExerciseId !== variables.planExerciseId) {
                        return exercise;
                    }

                    let newSetsCompleted = exercise.setsCompleted;
                    
                    if (variables.action === 'add') {
                        newSetsCompleted = Math.min(exercise.setsCompleted + 1, exercise.targetSets);
                    } else if (variables.action === 'remove') {
                        newSetsCompleted = Math.max(exercise.setsCompleted - 1, 0);
                    } else if (variables.action === 'complete-all') {
                        newSetsCompleted = exercise.targetSets;
                    }

                    return {
                        ...exercise,
                        setsCompleted: newSetsCompleted,
                        isDone: newSetsCompleted >= exercise.targetSets,
                    };
                });

                // Calculate new totals
                const newCompletedSets = newExercises.reduce(
                    (sum: number, ex: ExerciseWeekProgress) => sum + ex.setsCompleted, 
                    0
                );
                const totalSets = previousData.totalSets || 0;
                const newProgressPercent = totalSets > 0 
                    ? Math.round((newCompletedSets / totalSets) * 100) 
                    : 0;

                queryClient.setQueryData<GetWeekProgressResponse>(
                    weekProgressQueryKey(variables.planId, variables.weekNumber),
                    {
                        ...previousData,
                        exercises: newExercises,
                        completedSets: newCompletedSets,
                        progressPercent: newProgressPercent,
                    }
                );
            }

            // Return snapshot for rollback on error ONLY
            return { previousData };
        },
        // ONLY on error: rollback to previous state
        onError: (_error, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(
                    weekProgressQueryKey(variables.planId, variables.weekNumber),
                    context.previousData
                );
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook to sync active plan with store and server data
 */
export function useSyncActivePlan() {
    const { data: plansData } = usePlans();
    const activePlanId = useActivePlanId();
    const setActivePlan = useWorkoutStore((state) => state.setActivePlan);
    const setWeek = useWorkoutStore((state) => state.setWeek);

    useEffect(() => {
        if (!plansData?.plans?.length) return;

        // Find the active plan from server
        const activePlan = plansData.plans.find((p) => p.isActive);

        if (activePlan) {
            // If there's an active plan, sync it to the store
            if (activePlanId !== activePlan._id) {
                setActivePlan(activePlan._id);
            }
        } else if (plansData.plans.length > 0 && !activePlanId) {
            // No active plan but plans exist, use the first one
            setActivePlan(plansData.plans[0]._id);
        }
    }, [plansData?.plans, activePlanId, setActivePlan, setWeek]);

    // Get the current active plan object
    const activePlan = plansData?.plans?.find((p) => p._id === activePlanId);

    return { activePlan, plans: plansData?.plans || [] };
}

