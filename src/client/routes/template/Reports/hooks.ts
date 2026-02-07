/**
 * Reports Route Hooks
 * 
 * React Query hooks for the Reports dashboard.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReports, updateReportStatus, deleteReport, deleteAllReports, batchUpdateStatus, batchDeleteReports } from '@/apis/template/reports/client';
import type { GetReportsRequest, ReportStatus } from '@/apis/template/reports/types';
import { useQueryDefaults } from '@/client/query';
import { toast } from '@/client/components/template/ui/toast';

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
                return old.map((report) => (report._id === reportId ? { ...report, status } : report));
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
                return old.filter((report) => report._id !== reportId);
            });

            return { previous };
        },
        onError: (err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to delete report');
        },
        // NOTE: Toast here is UI feedback only, NOT a state update.
        // This does NOT violate the optimistic-only pattern.
        // See docs/react-query-mutations.md "What's Allowed in onSuccess/onError?"
        onSuccess: () => {
            toast.success('Report deleted successfully');
        },
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

export function useBatchUpdateStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ reportIds, status }: { reportIds: string[]; status: ReportStatus }) => {
            const result = await batchUpdateStatus({ reportIds, status });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onMutate: async ({ reportIds, status }) => {
            await queryClient.cancelQueries({ queryKey: reportsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: reportsBaseQueryKey });

            queryClient.setQueriesData({ queryKey: reportsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((report) =>
                    reportIds.includes(report._id) ? { ...report, status } : report
                );
            });

            return { previous };
        },
        onError: (err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to update reports');
        },
        onSuccess: (_data, { reportIds, status }) => {
            toast.success(`Updated ${reportIds.length} report(s) to ${status}`);
        },
        onSettled: () => {},
    });
}

export function useBatchDeleteReports() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (reportIds: string[]) => {
            const result = await batchDeleteReports({ reportIds });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onMutate: async (reportIds) => {
            await queryClient.cancelQueries({ queryKey: reportsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: reportsBaseQueryKey });

            queryClient.setQueriesData({ queryKey: reportsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.filter((report) => !reportIds.includes(report._id));
            });

            return { previous };
        },
        onError: (err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to delete reports');
        },
        onSuccess: (_data, reportIds) => {
            toast.success(`Deleted ${reportIds.length} report(s)`);
        },
        onSettled: () => {},
    });
}

