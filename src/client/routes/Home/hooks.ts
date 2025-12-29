/**
 * Home route hooks
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
 *   1. User creates workout → UI shows new workout (optimistic)
 *   2. User deletes it quickly → UI removes workout (optimistic)
 *   3. Server response for create arrives → UI would re-add deleted workout (WRONG!)
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
import {
    listSavedWorkouts,
    createSavedWorkout,
    updateSavedWorkout,
    deleteSavedWorkout,
    reorderSavedWorkouts,
} from '@/apis/saved-workouts/client';
import type {
    ListSavedWorkoutsResponse,
    CreateSavedWorkoutRequest,
    UpdateSavedWorkoutRequest,
    DeleteSavedWorkoutRequest,
    ReorderSavedWorkoutsRequest,
    SavedWorkoutWithExercises,
} from '@/apis/saved-workouts/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

// Extended request with exercise definitions for optimistic updates (client-side only)
interface CreateSavedWorkoutWithDefs extends CreateSavedWorkoutRequest {
    /** Exercise definitions for optimistic UI update (not sent to server) */
    exerciseDefs: ExerciseDefinitionClient[];
}

// ============================================================================
// Query Keys
// ============================================================================

export const savedWorkoutsQueryKey = ['saved-workouts'] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all saved workouts
 */
export function useSavedWorkouts(options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: savedWorkoutsQueryKey,
        queryFn: async (): Promise<ListSavedWorkoutsResponse> => {
            const response = await listSavedWorkouts({});
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
 * Hook for creating a new saved workout
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates immediately with temp ID in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useCreateSavedWorkout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateSavedWorkoutWithDefs) => {
            // Only send what the server needs (exclude exerciseDefs)
            const { exerciseDefs: _, ...requestData } = data;
            const response = await createSavedWorkout(requestData);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.workout;
        },
        // OPTIMISTIC UPDATE: Add workout to list immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: savedWorkoutsQueryKey });
            const previousWorkouts = queryClient.getQueryData<ListSavedWorkoutsResponse>(savedWorkoutsQueryKey);

            // Create optimistic workout with temporary ID
            // Get the next order number
            const existingWorkouts = previousWorkouts?.workouts || [];
            const nextOrder = existingWorkouts.length;

            // Create a map of exercise definitions for quick lookup
            const exerciseDefMap = new Map(
                variables.exerciseDefs.map((def) => [def._id, def])
            );

            const optimisticWorkout: SavedWorkoutWithExercises = {
                _id: `temp-${Date.now()}`,
                userId: '',
                name: variables.name,
                exercises: variables.exercises.map((ex, index) => ({
                    exerciseDefId: ex.exerciseDefId,
                    sets: ex.sets,
                    reps: ex.reps,
                    weight: ex.weight,
                    durationSeconds: ex.durationSeconds ?? 0,
                    order: index,
                    // Use real exercise definition from provided data
                    exerciseDef: exerciseDefMap.get(ex.exerciseDefId) || {
                        _id: ex.exerciseDefId,
                        name: 'Unknown',
                        imageUrl: '',
                        primaryMuscle: '',
                        secondaryMuscles: [] as string[],
                        type: '',
                        isBodyweight: false,
                        isStatic: false,
                        isSystem: true,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    },
                })),
                order: nextOrder,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<ListSavedWorkoutsResponse>(savedWorkoutsQueryKey, (old) => {
                if (!old?.workouts) return { workouts: [optimisticWorkout] };
                return { workouts: [...old.workouts, optimisticWorkout] };
            });

            return { previousWorkouts, optimisticWorkout };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousWorkouts) {
                queryClient.setQueryData(savedWorkoutsQueryKey, context.previousWorkouts);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for updating a saved workout
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useUpdateSavedWorkout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateSavedWorkoutRequest) => {
            const response = await updateSavedWorkout(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.workout;
        },
        // OPTIMISTIC UPDATE: Update workout immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: savedWorkoutsQueryKey });
            const previousWorkouts = queryClient.getQueryData<ListSavedWorkoutsResponse>(savedWorkoutsQueryKey);

            queryClient.setQueryData<ListSavedWorkoutsResponse>(savedWorkoutsQueryKey, (old) => {
                if (!old?.workouts) return old;
                return {
                    workouts: old.workouts.map((workout) => {
                        if (workout._id !== variables.workoutId) return workout;
                        
                        const updates: Partial<SavedWorkoutWithExercises> = {
                            updatedAt: new Date().toISOString(),
                        };
                        
                        if (variables.name !== undefined) {
                            updates.name = variables.name;
                        }
                        
                        // Handle exercises update with exercise definitions preserved
                        if (variables.exercises !== undefined) {
                            updates.exercises = variables.exercises.map((ex, index) => {
                                // Try to find existing exercise def from current workout
                                const existingEx = workout.exercises.find(
                                    (e) => e.exerciseDefId === ex.exerciseDefId
                                );
                                return {
                                    exerciseDefId: ex.exerciseDefId,
                                    sets: ex.sets,
                                    reps: ex.reps,
                                    weight: ex.weight,
                                    durationSeconds: ex.durationSeconds ?? 0,
                                    order: index,
                                    exerciseDef: existingEx?.exerciseDef || {
                                        _id: ex.exerciseDefId,
                                        name: 'Loading...',
                                        imageUrl: '',
                                        primaryMuscle: '',
                                        secondaryMuscles: [] as string[],
                                        type: '',
                                        isBodyweight: false,
                                        isStatic: false,
                                        isSystem: true,
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                    },
                                };
                            });
                        }
                        
                        return { ...workout, ...updates };
                    }),
                };
            });

            return { previousWorkouts };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousWorkouts) {
                queryClient.setQueryData(savedWorkoutsQueryKey, context.previousWorkouts);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for deleting a saved workout
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI removes item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useDeleteSavedWorkout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DeleteSavedWorkoutRequest) => {
            const response = await deleteSavedWorkout(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return data.workoutId;
        },
        // OPTIMISTIC UPDATE: Remove workout immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: savedWorkoutsQueryKey });
            const previousWorkouts = queryClient.getQueryData<ListSavedWorkoutsResponse>(savedWorkoutsQueryKey);

            queryClient.setQueryData<ListSavedWorkoutsResponse>(savedWorkoutsQueryKey, (old) => {
                if (!old?.workouts) return old;
                return {
                    workouts: old.workouts.filter((workout) => workout._id !== variables.workoutId),
                };
            });

            return { previousWorkouts };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousWorkouts) {
                queryClient.setQueryData(savedWorkoutsQueryKey, context.previousWorkouts);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for reordering saved workouts
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI reorders items immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useReorderSavedWorkouts() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: ReorderSavedWorkoutsRequest) => {
            const response = await reorderSavedWorkouts(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // OPTIMISTIC UPDATE: Reorder workouts immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: savedWorkoutsQueryKey });
            const previousWorkouts = queryClient.getQueryData<ListSavedWorkoutsResponse>(savedWorkoutsQueryKey);

            queryClient.setQueryData<ListSavedWorkoutsResponse>(savedWorkoutsQueryKey, (old) => {
                if (!old?.workouts) return old;
                // Reorder workouts based on the new order from workoutIds
                const workoutMap = new Map(old.workouts.map((w) => [w._id, w]));
                const reorderedWorkouts = variables.workoutIds
                    .map((id, index) => {
                        const workout = workoutMap.get(id);
                        if (workout) {
                            return { ...workout, order: index };
                        }
                        return null;
                    })
                    .filter((w): w is SavedWorkoutWithExercises => w !== null);
                return { workouts: reorderedWorkouts };
            });

            return { previousWorkouts };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousWorkouts) {
                queryClient.setQueryData(savedWorkoutsQueryKey, context.previousWorkouts);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

