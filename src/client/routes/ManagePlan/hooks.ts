/**
 * Manage Plan route hooks
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
 */
export function useAddPlanExercise() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: AddPlanExerciseRequest) => {
            const response = await addPlanExercise(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.exercise;
        },
        onSuccess: (newExercise, variables) => {
            if (newExercise) {
                queryClient.setQueryData<ListPlanExercisesResponse>(
                    planExercisesQueryKey(variables.planId),
                    (old) => {
                        if (!old?.exercises) return { exercises: [newExercise] };
                        return { exercises: [...old.exercises, newExercise] };
                    }
                );
            }
            queryClient.invalidateQueries({
                queryKey: planExercisesQueryKey(variables.planId),
            });
        },
    });
}

/**
 * Hook for updating a plan exercise
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
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: planExercisesQueryKey(planId) });
            const previous = queryClient.getQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(planId)
            );

            // Optimistic update
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
        onError: (_err, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(planExercisesQueryKey(planId), context.previous);
            }
        },
    });
}

/**
 * Hook for deleting a plan exercise
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
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: planExercisesQueryKey(planId) });
            const previous = queryClient.getQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(planId)
            );

            // Optimistic update
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
        onError: (_err, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(planExercisesQueryKey(planId), context.previous);
            }
        },
    });
}

