/**
 * Manage Plan route hooks
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
 *   1. User adds exercise → UI shows it (optimistic)
 *   2. User deletes it quickly → UI removes it (optimistic)
 *   3. Server response for add arrives → UI would re-add deleted item (WRONG!)
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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query/defaults';
import { getPlan } from '@/apis/training-plans/client';
import {
    listPlanExercises,
    addPlanExercise,
    updatePlanExercise,
    deletePlanExercise,
} from '@/apis/plan-exercises/client';
import { listExercises } from '@/apis/exercise-definitions/client';
import type { GetPlanResponse } from '@/apis/training-plans/types';
import type {
    ListPlanExercisesResponse,
    AddPlanExerciseRequest,
    UpdatePlanExerciseRequest,
    DeletePlanExerciseRequest,
    PlanExerciseWithDefinition,
} from '@/apis/plan-exercises/types';
import type { ListExercisesResponse } from '@/apis/exercise-definitions/types';

// ============================================================================
// Query Keys
// ============================================================================

export const planQueryKey = (planId: string) => ['training-plans', planId] as const;
export const planExercisesQueryKey = (planId: string) => ['plan-exercises', planId] as const;
export const exercisesQueryKey = ['exercise-definitions'] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch a single plan
 */
export function usePlan(planId: string, options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: planQueryKey(planId),
        queryFn: async (): Promise<GetPlanResponse> => {
            const response = await getPlan({ planId });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: (options?.enabled ?? true) && !!planId,
        ...queryDefaults,
    });
}

/**
 * Hook to fetch exercises in a plan
 */
export function usePlanExercises(planId: string, options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: planExercisesQueryKey(planId),
        queryFn: async (): Promise<ListPlanExercisesResponse> => {
            const response = await listPlanExercises({ planId });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: (options?.enabled ?? true) && !!planId,
        ...queryDefaults,
    });
}

/**
 * Hook to fetch all available exercises (for adding to plan)
 */
export function useExerciseLibrary(options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: exercisesQueryKey,
        queryFn: async (): Promise<ListExercisesResponse> => {
            const response = await listExercises({});
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
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
 * Hook for adding an exercise to a plan
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI adds item immediately with temp ID in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useAddPlanExercise(exerciseLibrary?: ListExercisesResponse) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: AddPlanExerciseRequest) => {
            const response = await addPlanExercise(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.exercise;
        },
        // OPTIMISTIC UPDATE: Add exercise immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: planExercisesQueryKey(variables.planId) });
            const previous = queryClient.getQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(variables.planId)
            );

            // Find exercise definition from library
            const exerciseDef = exerciseLibrary?.exercises?.find(
                (ex) => ex._id === variables.exerciseDefId
            );

            if (exerciseDef) {
                // Create optimistic plan exercise with temporary ID
                const optimisticExercise: PlanExerciseWithDefinition = {
                    _id: `temp-${Date.now()}`,
                    planId: variables.planId,
                    exerciseDefId: variables.exerciseDefId,
                    sets: variables.sets,
                    reps: variables.reps,
                    weight: variables.weight || 0,
                    durationSeconds: variables.durationSeconds || 0,
                    comments: variables.comments || '',
                    order: (previous?.exercises?.length || 0),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    exerciseDef: exerciseDef,
                };

                queryClient.setQueryData<ListPlanExercisesResponse>(
                    planExercisesQueryKey(variables.planId),
                    (old) => {
                        if (!old?.exercises) return { exercises: [optimisticExercise] };
                        return { exercises: [...old.exercises, optimisticExercise] };
                    }
                );
            }

            return { previous };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(planExercisesQueryKey(variables.planId), context.previous);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for updating a plan exercise
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useUpdatePlanExercise(planId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdatePlanExerciseRequest) => {
            const response = await updatePlanExercise(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.exercise;
        },
        // OPTIMISTIC UPDATE: Update exercise immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: planExercisesQueryKey(planId) });
            const previous = queryClient.getQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(planId)
            );

            queryClient.setQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(planId),
                (old) => {
                    if (!old?.exercises) return old;
                    return {
                        exercises: old.exercises.map((ex) =>
                            ex._id === variables.planExerciseId
                                ? { ...ex, ...variables, updatedAt: new Date().toISOString() }
                                : ex
                        ),
                    };
                }
            );

            return { previous };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(planExercisesQueryKey(planId), context.previous);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for deleting a plan exercise
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI removes item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useDeletePlanExercise(planId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DeletePlanExerciseRequest) => {
            const response = await deletePlanExercise(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return data.planExerciseId;
        },
        // OPTIMISTIC UPDATE: Remove exercise immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: planExercisesQueryKey(planId) });
            const previous = queryClient.getQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(planId)
            );

            queryClient.setQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(planId),
                (old) => {
                    if (!old?.exercises) return old;
                    return {
                        exercises: old.exercises.filter(
                            (ex) => ex._id !== variables.planExerciseId
                        ),
                    };
                }
            );

            return { previous };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(planExercisesQueryKey(planId), context.previous);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

