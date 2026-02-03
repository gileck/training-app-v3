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
    listExercises,
    createExercise,
    updateExercise,
    deleteExercise,
} from '@/apis/exercise-definitions/client';
import type { GetPlanResponse } from '@/apis/training-plans/types';
import type {
    ListExercisesResponse,
    CreateExerciseRequest,
    UpdateExerciseRequest,
    DeleteExerciseRequest,
} from '@/apis/exercise-definitions/types';

// ============================================================================
// Query Keys
// ============================================================================

export const planQueryKey = (planId: string) => ['training-plans', planId] as const;
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
// Custom Exercise Mutation Hooks
// ============================================================================

/**
 * Hook for creating a custom exercise
 * 
 * NON-OPTIMISTIC pattern:
 * Exercise creation may include image blob upload - server processes and stores.
 * Component shows loading state via isPending.
 */
export function useCreateExercise() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateExerciseRequest) => {
            const response = await createExercise(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.exercise;
        },
        // On success: insert the returned exercise into cache
        onSuccess: (serverExercise) => {
            if (!serverExercise) return; // Guard for offline
            queryClient.setQueryData<ListExercisesResponse>(exercisesQueryKey, (old) => {
                if (!old?.exercises) return { exercises: [serverExercise] };
                return { exercises: [...old.exercises, serverExercise] };
            });
        },
    });
}

/**
 * Hook for updating a custom exercise
 * 
 * Uses OPTIMISTIC-ONLY pattern
 */
export function useUpdateExercise() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateExerciseRequest) => {
            const response = await updateExercise(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.exercise;
        },
        // OPTIMISTIC UPDATE
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: exercisesQueryKey });
            const previous = queryClient.getQueryData<ListExercisesResponse>(exercisesQueryKey);

            queryClient.setQueryData<ListExercisesResponse>(exercisesQueryKey, (old) => {
                if (!old?.exercises) return old;
                return {
                    exercises: old.exercises.map((ex) =>
                        ex._id === variables.exerciseId
                            ? {
                                  ...ex,
                                  ...(variables.name !== undefined && { name: variables.name }),
                                  ...(variables.primaryMuscle !== undefined && { primaryMuscle: variables.primaryMuscle }),
                                  ...(variables.secondaryMuscles !== undefined && { secondaryMuscles: variables.secondaryMuscles }),
                                  ...(variables.type !== undefined && { type: variables.type }),
                                  ...(variables.isBodyweight !== undefined && { isBodyweight: variables.isBodyweight }),
                                  ...(variables.isStatic !== undefined && { isStatic: variables.isStatic }),
                              }
                            : ex
                    ),
                };
            });

            return { previous };
        },
        // ONLY on error: rollback
        onError: (_err, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(exercisesQueryKey, context.previous);
            }
        },
    });
}

/**
 * Hook for deleting a custom exercise
 * 
 * Uses OPTIMISTIC-ONLY pattern
 */
export function useDeleteExercise() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DeleteExerciseRequest) => {
            const response = await deleteExercise(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return data.exerciseId;
        },
        // OPTIMISTIC UPDATE
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: exercisesQueryKey });
            const previous = queryClient.getQueryData<ListExercisesResponse>(exercisesQueryKey);

            queryClient.setQueryData<ListExercisesResponse>(exercisesQueryKey, (old) => {
                if (!old?.exercises) return old;
                return {
                    exercises: old.exercises.filter((ex) => ex._id !== variables.exerciseId),
                };
            });

            return { previous };
        },
        // ONLY on error: rollback
        onError: (_err, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(exercisesQueryKey, context.previous);
            }
        },
    });
}

