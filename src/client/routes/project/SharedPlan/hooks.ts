/**
 * SharedPlan Route Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { getSharedPlan } from '@/apis/training-plans/client';
import type { GetSharedPlanResponse } from '@/apis/training-plans/types';
import { useQueryDefaults } from '@/client/query/defaults';

// Re-export the shared utility for backward compatibility
export { exportDataToDraftPlan } from '../TrainingPlans/utils';

/**
 * Fetch a shared plan by token (PUBLIC API - no auth required)
 */
export function useSharedPlan(token: string | undefined) {
    const queryDefaults = useQueryDefaults();
    
    return useQuery<GetSharedPlanResponse, Error>({
        queryKey: ['shared-plan', token],
        queryFn: async () => {
            if (!token) throw new Error('No token provided');
            const result = await getSharedPlan({ token });
            if (result.data?.error) {
                throw new Error(result.data.error);
            }
            return result.data as GetSharedPlanResponse;
        },
        enabled: !!token,
        ...queryDefaults,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
}
