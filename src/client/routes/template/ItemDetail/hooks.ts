import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFeatureRequest, deleteFeatureRequest, approveFeatureRequest } from '@/apis/template/feature-requests/client';
import { getReport, deleteReport } from '@/apis/template/reports/client';
import { API_APPROVE_BUG_REPORT } from '@/apis/template/reports/index';
import apiClient from '@/client/utils/apiClient';
import type { FeatureRequestClient } from '@/apis/template/feature-requests/types';
import type { ReportClient, ApproveBugReportResponse } from '@/apis/template/reports/types';

export type ItemType = 'feature' | 'bug';

export interface ItemDetail {
    type: ItemType;
    feature?: FeatureRequestClient;
    report?: ReportClient;
}

/**
 * Parse an item ID which may be a composite ID (e.g., "feature:mongoId")
 * or a plain MongoDB ObjectId. Returns the resolved mongoId and known type if any.
 */
export function parseItemId(id: string): { mongoId: string; knownType: 'feature' | 'report' | null } {
    const colonIndex = id.indexOf(':');
    if (colonIndex !== -1) {
        const prefix = id.substring(0, colonIndex);
        const mongoId = id.substring(colonIndex + 1);
        if (prefix === 'feature' || prefix === 'report') {
            return { mongoId, knownType: prefix };
        }
    }
    return { mongoId: id, knownType: null };
}

export function useItemDetail(id: string | undefined) {
    const { mongoId, knownType } = id ? parseItemId(id) : { mongoId: undefined, knownType: null };

    const featureQuery = useQuery({
        queryKey: ['item-detail-feature', mongoId],
        queryFn: async () => {
            const response = await getFeatureRequest({ requestId: mongoId! });
            return response.data?.featureRequest ?? null;
        },
        enabled: !!mongoId && knownType !== 'report',
    });

    const reportQuery = useQuery({
        queryKey: ['item-detail-report', mongoId],
        queryFn: async () => {
            const response = await getReport({ reportId: mongoId! });
            return response.data?.report ?? null;
        },
        enabled: !!mongoId && knownType !== 'feature',
    });

    const isLoading = featureQuery.isLoading || reportQuery.isLoading;
    const error = featureQuery.error || reportQuery.error;

    let item: ItemDetail | null = null;
    if (featureQuery.data) {
        item = { type: 'feature', feature: featureQuery.data };
    } else if (reportQuery.data) {
        item = { type: 'bug', report: reportQuery.data };
    }

    return { item, isLoading, error };
}

export function useApproveItem() {
    const queryClient = useQueryClient();

    const approveFeatureMutation = useMutation({
        mutationFn: async (requestId: string) => {
            const response = await approveFeatureRequest({ requestId });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        onMutate: async (requestId) => {
            await queryClient.cancelQueries({ queryKey: ['item-detail-feature', requestId] });
            const previous = queryClient.getQueryData<FeatureRequestClient | null>(['item-detail-feature', requestId]);
            if (previous) {
                queryClient.setQueryData<FeatureRequestClient | null>(
                    ['item-detail-feature', requestId],
                    { ...previous, status: 'in_progress' }
                );
            }
            return { previous, requestId };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(['item-detail-feature', context.requestId], context.previous);
            }
        },
        onSuccess: () => {},
        onSettled: () => {},
    });

    const approveBugMutation = useMutation({
        mutationFn: async (reportId: string) => {
            const response = await apiClient.post<ApproveBugReportResponse>(
                API_APPROVE_BUG_REPORT,
                { reportId }
            );
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        onMutate: async (reportId) => {
            await queryClient.cancelQueries({ queryKey: ['item-detail-report', reportId] });
            const previous = queryClient.getQueryData<ReportClient | null>(['item-detail-report', reportId]);
            if (previous) {
                queryClient.setQueryData<ReportClient | null>(
                    ['item-detail-report', reportId],
                    { ...previous, status: 'investigating' }
                );
            }
            return { previous, reportId };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(['item-detail-report', context.reportId], context.previous);
            }
        },
        onSuccess: () => {},
        onSettled: () => {},
    });

    return {
        approveFeature: approveFeatureMutation.mutateAsync,
        approveBug: approveBugMutation.mutateAsync,
        isPending: approveFeatureMutation.isPending || approveBugMutation.isPending,
    };
}

export function useDeleteItem() {
    const queryClient = useQueryClient();

    const deleteFeatureMutation = useMutation({
        mutationFn: async (requestId: string) => {
            const response = await deleteFeatureRequest({ requestId });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        onMutate: async (requestId) => {
            await queryClient.cancelQueries({ queryKey: ['item-detail-feature', requestId] });
            const previous = queryClient.getQueryData<FeatureRequestClient | null>(['item-detail-feature', requestId]);
            queryClient.setQueryData<FeatureRequestClient | null>(['item-detail-feature', requestId], null);
            return { previous, requestId };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(['item-detail-feature', context.requestId], context.previous);
            }
        },
        onSuccess: () => {},
        onSettled: () => {},
    });

    const deleteReportMutation = useMutation({
        mutationFn: async (reportId: string) => {
            const response = await deleteReport({ reportId });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        onMutate: async (reportId) => {
            await queryClient.cancelQueries({ queryKey: ['item-detail-report', reportId] });
            const previous = queryClient.getQueryData<ReportClient | null>(['item-detail-report', reportId]);
            queryClient.setQueryData<ReportClient | null>(['item-detail-report', reportId], null);
            return { previous, reportId };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(['item-detail-report', context.reportId], context.previous);
            }
        },
        onSuccess: () => {},
        onSettled: () => {},
    });

    return {
        deleteFeature: deleteFeatureMutation.mutateAsync,
        deleteBug: deleteReportMutation.mutateAsync,
        isPending: deleteFeatureMutation.isPending || deleteReportMutation.isPending,
    };
}
