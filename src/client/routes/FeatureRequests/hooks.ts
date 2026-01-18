/**
 * Feature Requests Route Hooks
 *
 * React Query hooks for the Feature Requests admin dashboard.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getFeatureRequests,
    updateFeatureRequestStatus,
    updateDesignReviewStatus,
    updatePriority,
    deleteFeatureRequest,
    addAdminComment,
} from '@/apis/feature-requests/client';
import type {
    GetFeatureRequestsRequest,
    FeatureRequestStatus,
    FeatureRequestPriority,
    DesignPhaseType,
    DesignReviewStatus,
} from '@/apis/feature-requests/types';
import { useQueryDefaults } from '@/client/query';
import { toast } from '@/client/components/ui/toast';

const featureRequestsBaseQueryKey = ['feature-requests'] as const;

export function useFeatureRequests(filters?: GetFeatureRequestsRequest) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: [...featureRequestsBaseQueryKey, filters],
        queryFn: async () => {
            const result = await getFeatureRequests(filters);
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.featureRequests || [];
        },
        ...queryDefaults,
    });
}

export function useUpdateFeatureRequestStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestId, status }: { requestId: string; status: FeatureRequestStatus }) => {
            const result = await updateFeatureRequestStatus({ requestId, status });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.featureRequest;
        },
        onMutate: async ({ requestId, status }) => {
            await queryClient.cancelQueries({ queryKey: featureRequestsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: featureRequestsBaseQueryKey });

            queryClient.setQueriesData({ queryKey: featureRequestsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((request) =>
                    request._id === requestId ? { ...request, status } : request
                );
            });

            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to update status');
        },
        onSuccess: () => {},
        onSettled: () => {},
    });
}

export function useUpdateDesignReviewStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            requestId,
            phase,
            reviewStatus,
            adminComments,
        }: {
            requestId: string;
            phase: DesignPhaseType;
            reviewStatus: DesignReviewStatus;
            adminComments?: string;
        }) => {
            const result = await updateDesignReviewStatus({
                requestId,
                phase,
                reviewStatus,
                adminComments,
            });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.featureRequest;
        },
        onMutate: async ({ requestId, phase, reviewStatus }) => {
            await queryClient.cancelQueries({ queryKey: featureRequestsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: featureRequestsBaseQueryKey });

            queryClient.setQueriesData({ queryKey: featureRequestsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((request) => {
                    if (request._id !== requestId) return request;
                    const designKey = phase === 'product' ? 'productDesign' : 'techDesign';
                    return {
                        ...request,
                        [designKey]: {
                            ...request[designKey],
                            reviewStatus,
                        },
                    };
                });
            });

            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to update design review status');
        },
        onSuccess: (_data, { reviewStatus }) => {
            if (reviewStatus === 'approved') {
                toast.success('Design approved');
            } else if (reviewStatus === 'rejected') {
                toast.success('Design rejected with feedback');
            }
        },
        onSettled: () => {},
    });
}

export function useUpdatePriority() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            requestId,
            priority,
        }: {
            requestId: string;
            priority: FeatureRequestPriority;
        }) => {
            const result = await updatePriority({ requestId, priority });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.featureRequest;
        },
        onMutate: async ({ requestId, priority }) => {
            await queryClient.cancelQueries({ queryKey: featureRequestsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: featureRequestsBaseQueryKey });

            queryClient.setQueriesData({ queryKey: featureRequestsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((request) =>
                    request._id === requestId ? { ...request, priority } : request
                );
            });

            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to update priority');
        },
        onSuccess: () => {},
        onSettled: () => {},
    });
}

export function useDeleteFeatureRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (requestId: string) => {
            const result = await deleteFeatureRequest({ requestId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onMutate: async (requestId) => {
            await queryClient.cancelQueries({ queryKey: featureRequestsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: featureRequestsBaseQueryKey });

            queryClient.setQueriesData({ queryKey: featureRequestsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.filter((request) => request._id !== requestId);
            });

            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to delete feature request');
        },
        onSuccess: () => {
            toast.success('Feature request deleted');
        },
        onSettled: () => {},
    });
}

export function useAddAdminComment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestId, content }: { requestId: string; content: string }) => {
            const result = await addAdminComment({ requestId, content });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.featureRequest;
        },
        onMutate: async ({ requestId, content }) => {
            await queryClient.cancelQueries({ queryKey: featureRequestsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: featureRequestsBaseQueryKey });

            // Optimistically add the comment
            const newComment = {
                id: `temp-${Date.now()}`,
                authorId: 'admin',
                authorName: 'Admin',
                isAdmin: true,
                content,
                createdAt: new Date().toISOString(),
            };

            queryClient.setQueriesData({ queryKey: featureRequestsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((request) =>
                    request._id === requestId
                        ? { ...request, comments: [...(request.comments || []), newComment] }
                        : request
                );
            });

            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to add comment');
        },
        onSuccess: () => {},
        onSettled: () => {},
    });
}
