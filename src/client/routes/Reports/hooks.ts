/**
 * Reports Route Hooks
 * 
 * React Query hooks for the Reports dashboard.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReports, updateReportStatus, deleteReport, deleteAllReports } from '@/apis/reports/client';
import type { GetReportsRequest, ReportStatus } from '@/apis/reports/types';
import { useQueryDefaults } from '@/client/query';

const reportsBaseQueryKey = ['reports'] as const;

export function useReports(filters?: GetReportsRequest) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: [...reportsBaseQueryKey, filters],
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
        onMutate: async ({ reportId, status }) => {
            await queryClient.cancelQueries({ queryKey: reportsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: reportsBaseQueryKey });

            queryClient.setQueriesData({ queryKey: reportsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((report) => (report.id === reportId ? { ...report, status } : report));
            });

            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
        },
        // Optimistic-only: never update from server response, never invalidate from mutations
        onSuccess: () => {},
        onSettled: () => {},
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
        onMutate: async (reportId) => {
            await queryClient.cancelQueries({ queryKey: reportsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: reportsBaseQueryKey });

            queryClient.setQueriesData({ queryKey: reportsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.filter((report) => report.id !== reportId);
            });

            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
        },
        onSuccess: () => {},
        onSettled: () => {},
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
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: reportsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: reportsBaseQueryKey });
            queryClient.setQueriesData({ queryKey: reportsBaseQueryKey }, () => []);
            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
        },
        onSuccess: () => {},
        onSettled: () => {},
    });
}

