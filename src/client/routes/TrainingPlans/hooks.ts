/**
 * Training Plans route hooks
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
 *   1. User creates plan → UI shows new plan (optimistic)
 *   2. User deletes it quickly → UI removes plan (optimistic)
 *   3. Server response for create arrives → UI would re-add deleted plan (WRONG!)
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
    listPlans,
    createPlan,
    deletePlan,
    setActivePlan,
} from '@/apis/training-plans/client';
import { listPlanExercises } from '@/apis/plan-exercises/client';
import type {
    ListPlansResponse,
    CreatePlanRequest,
    DeletePlanRequest,
    SetActivePlanRequest,
} from '@/apis/training-plans/types';
import type { TrainingPlanClient } from '@/server/database/collections/trainingPlans/types';
import type { ListPlanExercisesResponse } from '@/apis/plan-exercises/types';

// ============================================================================
// Query Keys
// ============================================================================

export const plansQueryKey = ['training-plans'] as const;
export const planQueryKey = (planId: string) => ['training-plans', planId] as const;
export const planExercisesQueryKey = (planId: string) => ['plan-exercises', planId] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all training plans
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
 * Hook to fetch exercises for a plan (for exercise count)
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

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for creating a new training plan
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates immediately with temp ID in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 * 
 * Note: The temp ID stays in UI - this is fine because:
 * - Next page load will fetch fresh data with real IDs
 * - User can still interact with the plan normally
 */
export function useCreatePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreatePlanRequest) => {
            const response = await createPlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.plan;
        },
        // OPTIMISTIC UPDATE: Add plan to list immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: plansQueryKey });
            const previousPlans = queryClient.getQueryData<ListPlansResponse>(plansQueryKey);

            // Create optimistic plan with temporary ID
            const optimisticPlan: TrainingPlanClient = {
                _id: `temp-${Date.now()}`,
                userId: '',
                name: variables.name,
                durationWeeks: variables.durationWeeks,
                isActive: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return { plans: [optimisticPlan] };
                return { plans: [...old.plans, optimisticPlan] };
            });

            return { previousPlans, optimisticPlan };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousPlans) {
                queryClient.setQueryData(plansQueryKey, context.previousPlans);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for deleting a training plan
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI removes item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useDeletePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DeletePlanRequest) => {
            const response = await deletePlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return data.planId;
        },
        // OPTIMISTIC UPDATE: Remove plan immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: plansQueryKey });
            const previousPlans = queryClient.getQueryData<ListPlansResponse>(plansQueryKey);

            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return old;
                return {
                    plans: old.plans.filter((plan) => plan._id !== variables.planId),
                };
            });

            // Also clear related queries (these won't cause race conditions)
            queryClient.removeQueries({ queryKey: planQueryKey(variables.planId) });
            queryClient.removeQueries({ queryKey: planExercisesQueryKey(variables.planId) });

            return { previousPlans };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousPlans) {
                queryClient.setQueryData(plansQueryKey, context.previousPlans);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for setting a plan as active
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates active state immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 */
export function useSetActivePlan() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: SetActivePlanRequest) => {
            const response = await setActivePlan(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.plan;
        },
        // OPTIMISTIC UPDATE: Set active immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: plansQueryKey });
            const previousPlans = queryClient.getQueryData<ListPlansResponse>(plansQueryKey);

            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return old;
                return {
                    plans: old.plans.map((plan) => ({
                        ...plan,
                        isActive: plan._id === variables.planId,
                    })),
                };
            });

            return { previousPlans };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousPlans) {
                queryClient.setQueryData(plansQueryKey, context.previousPlans);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

