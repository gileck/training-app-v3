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
    bulkAddPlanExercises,
    updatePlanExercise,
    deletePlanExercise,
    reorderPlanExercises,
} from '@/apis/plan-exercises/client';
import {
    listExercises,
    createExercise,
    updateExercise,
    deleteExercise,
} from '@/apis/exercise-definitions/client';
import type { GetPlanResponse } from '@/apis/training-plans/types';
import type {
    ListPlanExercisesResponse,
    AddPlanExerciseRequest,
    BulkAddPlanExercisesRequest,
    BulkAddPlanExercisesResponse,
    UpdatePlanExerciseRequest,
    DeletePlanExerciseRequest,
    ReorderPlanExercisesRequest,
    PlanExerciseWithDefinition,
} from '@/apis/plan-exercises/types';
import type {
    ListExercisesResponse,
    CreateExerciseRequest,
    UpdateExerciseRequest,
    DeleteExerciseRequest,
} from '@/apis/exercise-definitions/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

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
        // OPTIMISTIC UPDATE: Add exercise immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: planExercisesQueryKey(variables.planId) });
            const previous = queryClient.getQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(variables.planId)
            );

            // Get fresh exercise library data from cache (not from stale closure)
            const exerciseLibrary = queryClient.getQueryData<ListExercisesResponse>(exercisesQueryKey);
            
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
 * Hook for bulk adding exercises to a plan
 * 
 * Uses OPTIMISTIC pattern:
 * - UI adds all exercises immediately in onMutate
 * - Server response updates with real IDs on success
 * - On error, rollback to previous state
 */
export function useBulkAddPlanExercises() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: BulkAddPlanExercisesRequest) => {
            const response = await bulkAddPlanExercises(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data as BulkAddPlanExercisesResponse;
        },
        // OPTIMISTIC UPDATE: Add all exercises immediately
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: planExercisesQueryKey(variables.planId) });
            const previous = queryClient.getQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(variables.planId)
            );

            // Get exercise library for definitions
            const exerciseLibrary = queryClient.getQueryData<ListExercisesResponse>(exercisesQueryKey);
            
            const currentCount = previous?.exercises?.length || 0;
            const optimisticExercises: PlanExerciseWithDefinition[] = [];

            variables.exercises.forEach((item, index) => {
                const exerciseDef = exerciseLibrary?.exercises?.find(
                    (ex) => ex._id === item.exerciseDefId
                );

                if (exerciseDef) {
                    optimisticExercises.push({
                        _id: `temp-${Date.now()}-${index}`,
                        planId: variables.planId,
                        exerciseDefId: item.exerciseDefId,
                        sets: item.sets,
                        reps: item.reps,
                        weight: item.weight || 0,
                        durationSeconds: item.durationSeconds || 0,
                        comments: item.comments || '',
                        order: currentCount + index,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        exerciseDef,
                    });
                }
            });

            queryClient.setQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(variables.planId),
                (old) => {
                    if (!old?.exercises) return { exercises: optimisticExercises };
                    return { exercises: [...old.exercises, ...optimisticExercises] };
                }
            );

            return { previous, optimisticExercises };
        },
        // On success: replace temp entries with real server data
        onSuccess: (response, variables, context) => {
            if (response?.results && response.results.length > 0 && context?.optimisticExercises) {
                queryClient.setQueryData<ListPlanExercisesResponse>(
                    planExercisesQueryKey(variables.planId),
                    (old) => {
                        if (!old?.exercises) return old;
                        
                        // Remove temp entries and add server entries
                        const nonTempExercises = old.exercises.filter(
                            (ex) => !ex._id.startsWith('temp-')
                        );
                        
                        const serverExercises = response.results!
                            .filter((r) => r.exercise)
                            .map((r) => r.exercise!);
                        
                        return { exercises: [...nonTempExercises, ...serverExercises] };
                    }
                );
            }
        },
        // On error: rollback to previous state
        onError: (_err, variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(planExercisesQueryKey(variables.planId), context.previous);
            }
        },
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

/**
 * Hook for reordering exercises in a plan
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI reorders items immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useReorderPlanExercises(planId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: ReorderPlanExercisesRequest) => {
            const response = await reorderPlanExercises(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // OPTIMISTIC UPDATE: Reorder exercises immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: planExercisesQueryKey(planId) });
            const previous = queryClient.getQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(planId)
            );

            queryClient.setQueryData<ListPlanExercisesResponse>(
                planExercisesQueryKey(planId),
                (old) => {
                    if (!old?.exercises) return old;
                    // Reorder exercises based on the new order
                    const exerciseMap = new Map(
                        old.exercises.map((ex) => [ex._id, ex])
                    );
                    const reordered = variables.exerciseIds
                        .map((id) => exerciseMap.get(id))
                        .filter((ex): ex is PlanExerciseWithDefinition => ex !== undefined)
                        .map((ex, index) => ({ ...ex, order: index }));
                    return { exercises: reordered };
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

// ============================================================================
// Custom Exercise Mutation Hooks
// ============================================================================

/**
 * Hook for creating a custom exercise
 * 
 * Uses OPTIMISTIC pattern with server ID replacement:
 * - UI adds exercise to library immediately in onMutate (with temp ID)
 * - On success, replace temp ID with real server ID (needed for adding to plan)
 * - Only on ERROR do we rollback to previous state
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
        // OPTIMISTIC UPDATE: Add exercise immediately
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: exercisesQueryKey });
            const previous = queryClient.getQueryData<ListExercisesResponse>(exercisesQueryKey);

            // Create optimistic exercise with temp ID
            const tempId = `temp-${Date.now()}`;
            const optimisticExercise: ExerciseDefinitionClient = {
                _id: tempId,
                name: variables.name,
                imageUrl: '', // Will be set by server if image is uploaded
                primaryMuscle: variables.primaryMuscle,
                secondaryMuscles: variables.secondaryMuscles || [],
                type: variables.type || 'Strength',
                isBodyweight: variables.isBodyweight || false,
                isStatic: variables.isStatic || false,
                isSystem: false,
                userId: '', // Will be set by server
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<ListExercisesResponse>(exercisesQueryKey, (old) => {
                if (!old?.exercises) return { exercises: [optimisticExercise] };
                return { exercises: [...old.exercises, optimisticExercise] };
            });

            return { previous, optimisticExercise, tempId };
        },
        // On success: replace temp entry with real server data (needed for valid ID)
        onSuccess: (serverExercise, _variables, context) => {
            if (serverExercise && context?.tempId) {
                queryClient.setQueryData<ListExercisesResponse>(exercisesQueryKey, (old) => {
                    if (!old?.exercises) return old;
                    return {
                        exercises: old.exercises.map((ex) =>
                            ex._id === context.tempId ? serverExercise : ex
                        ),
                    };
                });
            }
        },
        // On error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(exercisesQueryKey, context.previous);
            }
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

