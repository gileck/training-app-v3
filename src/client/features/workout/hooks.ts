/**
 * Workout feature hooks
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query/defaults';
import { getWeekProgress, updateSets } from '@/apis/weekly-progress/client';
import { listPlans } from '@/apis/training-plans/client';
import { useWorkoutStore, useActivePlanId } from './store';
import type { GetWeekProgressResponse, UpdateSetsRequest } from '@/apis/weekly-progress/types';
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
 * Hook to update sets (add/remove)
 */
export function useUpdateSets() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateSetsRequest) => {
            const response = await updateSets(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        onSuccess: (_data, variables) => {
            // Invalidate the week progress query
            queryClient.invalidateQueries({
                queryKey: weekProgressQueryKey(variables.planId, variables.weekNumber),
            });
        },
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

