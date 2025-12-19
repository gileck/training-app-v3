/**
 * Reports Route Hooks
 * 
 * React Query hooks for the Reports dashboard.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReports, updateReportStatus, deleteReport, deleteAllReports } from '@/apis/reports/client';
import type { GetReportsRequest, ReportStatus } from '@/apis/reports/types';
import { useQueryDefaults } from '@/client/query';

export function useReports(filters?: GetReportsRequest) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: ['reports', filters],
        queryFn: async () => {
            const result = await getReports(filters);
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.reports || [];
        },
        ...queryDefaults,
    });
}

export function useUpdateReportStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ reportId, status }: { reportId: string; status: ReportStatus }) => {
            const result = await updateReportStatus({ reportId, status });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.report;
        },
        onSuccess: () => {
            // Invalidate reports query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
}

export function useDeleteReport() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (reportId: string) => {
            const result = await deleteReport({ reportId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onSuccess: () => {
            // Invalidate reports query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
}

export function useDeleteAllReports() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const result = await deleteAllReports();
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onSuccess: () => {
            // Invalidate reports query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });
}

