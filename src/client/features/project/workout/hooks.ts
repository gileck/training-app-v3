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
import { useQuery } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query/defaults';
import { getWeekProgress } from '@/apis/weekly-progress/client';
import { listPlans } from '@/apis/training-plans/client';
import { useWorkoutStore, useActivePlanId } from './store';
import type { GetWeekProgressResponse } from '@/apis/weekly-progress/types';
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
 * Hook to sync active plan with store and server data
 * 
 * Returns:
 * - activePlan: The currently active plan object (or undefined)
 * - plans: Array of all plans (empty array while loading or if no plans)
 * - isLoading: True when initial fetch is in progress with no cached data
 * - plansData: The raw query data (undefined while loading)
 */
export function useSyncActivePlan() {
    const { data: plansData, isLoading } = usePlans();
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

    return { 
        activePlan, 
        plans: plansData?.plans || [], 
        isLoading,
        plansData, // Raw data - undefined while loading, defined after fetch
    };
}

