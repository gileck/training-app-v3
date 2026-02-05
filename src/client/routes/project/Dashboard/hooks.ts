/**
 * Dashboard React Query Hooks
 *
 * Hooks for fetching dashboard analytics data with polling support.
 */

import { useQuery } from '@tanstack/react-query';
import { getDashboardAnalytics } from '@/apis/template/dashboard/client';
import { useQueryDefaults } from '@/client/query/defaults';
import { useDashboardStore } from './store';
import type { GetDashboardAnalyticsResponse } from '@/apis/template/dashboard/types';

// ============================================================================
// Query Keys
// ============================================================================

export const dashboardQueryKey = (startDate: string, endDate: string) =>
    ['dashboard', 'analytics', startDate, endDate] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch dashboard analytics data
 *
 * Features:
 * - Uses date range from dashboard store
 * - Polls every 30 seconds for "real-time" updates
 * - Respects user's cache settings
 */
export function useDashboardAnalytics() {
    const queryDefaults = useQueryDefaults();
    const startDate = useDashboardStore((s) => s.startDate);
    const endDate = useDashboardStore((s) => s.endDate);

    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    return useQuery({
        queryKey: dashboardQueryKey(startDateStr, endDateStr),
        queryFn: async (): Promise<GetDashboardAnalyticsResponse> => {
            const response = await getDashboardAnalytics({
                startDate: startDateStr,
                endDate: endDateStr,
            });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // Poll every 30 seconds for "real-time" updates
        refetchInterval: 30000,
        ...queryDefaults,
    });
}
