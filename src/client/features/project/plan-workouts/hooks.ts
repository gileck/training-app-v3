/**
 * Plan Workouts hooks
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
    listPlanWorkouts,
    createPlanWorkout,
    updatePlanWorkout,
    deletePlanWorkout,
    reorderPlanWorkouts,
} from '@/apis/project/plan-workouts/client';
import type {
    ListPlanWorkoutsResponse,
    CreatePlanWorkoutRequest,
    UpdatePlanWorkoutRequest,
    DeletePlanWorkoutRequest,
    ReorderPlanWorkoutsRequest,
    PlanWorkoutClient,
} from '@/apis/project/plan-workouts/types';
import { generateId } from '@/client/utils/id';

// ============================================================================
// Query Keys
// ============================================================================

export const planWorkoutsQueryKey = (planId: string | null) =>
    ['plan-workouts', { planId }] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all plan workouts for a specific plan
 */
export function usePlanWorkouts(planId: string | null, options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: planWorkoutsQueryKey(planId),
        queryFn: async (): Promise<ListPlanWorkoutsResponse> => {
            if (!planId) return { workouts: [] };
            const response = await listPlanWorkouts({ planId });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: (options?.enabled ?? true) && !!planId,
        ...queryDefaults,
    });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for creating a new plan workout
 * 
 * Uses OPTIMISTIC-ONLY pattern with client-generated UUID:
 * - Client generates stable UUID that server persists
 * - UI updates immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 * - Idempotent: retries with same ID won't create duplicates
 */
export function useCreatePlanWorkout(planId: string) {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data: CreatePlanWorkoutRequest & { _id: string }) => {
            const response = await createPlanWorkout(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.workout;
        },
        // OPTIMISTIC UPDATE: Add workout to list immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables: CreatePlanWorkoutRequest & { _id: string }) => {
            const queryKey = planWorkoutsQueryKey(planId);
            await queryClient.cancelQueries({ queryKey });
            const previousWorkouts = queryClient.getQueryData<ListPlanWorkoutsResponse>(queryKey);

            // Calculate order from existing workouts
            const existingWorkouts = previousWorkouts?.workouts || [];
            const nextOrder = existingWorkouts.length;

            // Create optimistic workout with client-generated UUID
            const optimisticWorkout: PlanWorkoutClient = {
                _id: variables._id,
                userId: '',
                planId: variables.planId,
                name: variables.name,
                items: variables.items.map((item, index) => ({
                    planExerciseId: item.planExerciseId,
                    order: index,
                    ...(item.sets !== undefined && { sets: item.sets }),
                })),
                order: nextOrder,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<ListPlanWorkoutsResponse>(queryKey, (old) => {
                if (!old?.workouts) return { workouts: [optimisticWorkout] };
                return { workouts: [...old.workouts, optimisticWorkout] };
            });

            return { previousWorkouts };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousWorkouts) {
                queryClient.setQueryData(planWorkoutsQueryKey(planId), context.previousWorkouts);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });

    // Wrap mutate to inject client-generated ID
    return {
        ...mutation,
        mutate: (data: CreatePlanWorkoutRequest, options?: Parameters<typeof mutation.mutate>[1]) => {
            return mutation.mutate({ ...data, _id: generateId() }, options);
        },
        mutateAsync: async (data: CreatePlanWorkoutRequest, options?: Parameters<typeof mutation.mutateAsync>[1]) => {
            return mutation.mutateAsync({ ...data, _id: generateId() }, options);
        },
    };
}

/**
 * Hook for updating a plan workout
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useUpdatePlanWorkout(planId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdatePlanWorkoutRequest) => {
            const response = await updatePlanWorkout(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.workout;
        },
        // OPTIMISTIC UPDATE: Update workout immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            const queryKey = planWorkoutsQueryKey(planId);
            await queryClient.cancelQueries({ queryKey });
            const previousWorkouts = queryClient.getQueryData<ListPlanWorkoutsResponse>(queryKey);

            queryClient.setQueryData<ListPlanWorkoutsResponse>(queryKey, (old) => {
                if (!old?.workouts) return old;
                return {
                    workouts: old.workouts.map((workout) => {
                        if (workout._id !== variables.workoutId) return workout;

                        const updates: Partial<PlanWorkoutClient> = {
                            updatedAt: new Date().toISOString(),
                        };

                        if (variables.name !== undefined) {
                            updates.name = variables.name;
                        }

                        if (variables.items !== undefined) {
                            updates.items = variables.items.map((item, index) => ({
                                planExerciseId: item.planExerciseId,
                                order: index,
                                ...(item.sets !== undefined && { sets: item.sets }),
                            }));
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
                queryClient.setQueryData(planWorkoutsQueryKey(planId), context.previousWorkouts);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for deleting a plan workout
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI removes item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useDeletePlanWorkout(planId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DeletePlanWorkoutRequest) => {
            const response = await deletePlanWorkout(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return data.workoutId;
        },
        // OPTIMISTIC UPDATE: Remove workout immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            const queryKey = planWorkoutsQueryKey(planId);
            await queryClient.cancelQueries({ queryKey });
            const previousWorkouts = queryClient.getQueryData<ListPlanWorkoutsResponse>(queryKey);

            queryClient.setQueryData<ListPlanWorkoutsResponse>(queryKey, (old) => {
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
                queryClient.setQueryData(planWorkoutsQueryKey(planId), context.previousWorkouts);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for reordering plan workouts
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI reorders items immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useReorderPlanWorkouts(planId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: ReorderPlanWorkoutsRequest) => {
            const response = await reorderPlanWorkouts(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // OPTIMISTIC UPDATE: Reorder workouts immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            const queryKey = planWorkoutsQueryKey(planId);
            await queryClient.cancelQueries({ queryKey });
            const previousWorkouts = queryClient.getQueryData<ListPlanWorkoutsResponse>(queryKey);

            queryClient.setQueryData<ListPlanWorkoutsResponse>(queryKey, (old) => {
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
                    .filter((w): w is PlanWorkoutClient => w !== null);
                return { workouts: reorderedWorkouts };
            });

            return { previousWorkouts };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousWorkouts) {
                queryClient.setQueryData(planWorkoutsQueryKey(planId), context.previousWorkouts);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}
