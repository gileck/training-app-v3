/**
 * Training Plans route hooks
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
        onSuccess: (newPlan) => {
            if (newPlan) {
                queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                    if (!old?.plans) return { plans: [newPlan] };
                    return { plans: [...old.plans, newPlan] };
                });
            }
            queryClient.invalidateQueries({ queryKey: plansQueryKey });
        },
    });
}

/**
 * Hook for deleting a training plan
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
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: plansQueryKey });
            const previousPlans = queryClient.getQueryData<ListPlansResponse>(plansQueryKey);

            // Optimistic update
            queryClient.setQueryData<ListPlansResponse>(plansQueryKey, (old) => {
                if (!old?.plans) return old;
                return {
                    plans: old.plans.filter((plan) => plan._id !== variables.planId),
                };
            });

            return { previousPlans };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousPlans) {
                queryClient.setQueryData(plansQueryKey, context.previousPlans);
            }
        },
        onSuccess: (deletedPlanId) => {
            if (deletedPlanId) {
                queryClient.removeQueries({ queryKey: planQueryKey(deletedPlanId) });
                queryClient.removeQueries({ queryKey: planExercisesQueryKey(deletedPlanId) });
            }
        },
    });
}

/**
 * Hook for setting a plan as active
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
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: plansQueryKey });
            const previousPlans = queryClient.getQueryData<ListPlansResponse>(plansQueryKey);

            // Optimistic update - set only this plan as active
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
        onError: (_err, _variables, context) => {
            if (context?.previousPlans) {
                queryClient.setQueryData(plansQueryKey, context.previousPlans);
            }
        },
    });
}

