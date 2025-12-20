import { useQuery } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query/defaults';
import { getActivity, getActivitySummary } from '@/apis/activity-logs/client';
import type {
    GetActivityResponse,
    GetActivitySummaryResponse,
} from '@/apis/activity-logs/types';

// ============================================================================
// Query Keys
// ============================================================================

export const activityQueryKey = (planId?: string) => ['activity', planId ?? 'all'] as const;
export const activitySummaryQueryKey = (period: string, planId?: string) =>
    ['activity-summary', period, planId ?? 'all'] as const;

// ============================================================================
// Query Hooks
// ============================================================================

export function useActivity(options?: {
    planId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    enabled?: boolean;
}) {
    const queryDefaults = useQueryDefaults();
    return useQuery({
        queryKey: activityQueryKey(options?.planId),
        queryFn: async (): Promise<GetActivityResponse> => {
            const response = await getActivity({
                planId: options?.planId,
                startDate: options?.startDate,
                endDate: options?.endDate,
                limit: options?.limit ?? 50,
            });
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults,
    });
}

export function useActivitySummary(options?: {
    planId?: string;
    period?: 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
    enabled?: boolean;
}) {
    const queryDefaults = useQueryDefaults();
    const period = options?.period ?? 'day';

    return useQuery({
        queryKey: activitySummaryQueryKey(period, options?.planId),
        queryFn: async (): Promise<GetActivitySummaryResponse> => {
            const response = await getActivitySummary({
                planId: options?.planId,
                period,
                startDate: options?.startDate,
                endDate: options?.endDate,
            });
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults,
    });
}


