/**
 * Feature Requests Route Hooks
 *
 * React Query hooks for the Feature Requests admin dashboard.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getFeatureRequests,
    getFeatureRequest,
    updateFeatureRequestStatus,
    updatePriority,
    deleteFeatureRequest,
    addAdminComment,
    createFeatureRequest,
} from '@/apis/template/feature-requests/client';
import type {
    GetFeatureRequestsRequest,
    FeatureRequestStatus,
    FeatureRequestPriority,
    CreateFeatureRequestRequest,
} from '@/apis/template/feature-requests/types';
import { useQueryDefaults } from '@/client/query';
import { toast } from '@/client/components/template/ui/toast';
import { generateId } from '@/client/utils/id';

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

/**
 * Hook to fetch a single feature request by ID (admin only)
 */
export function useFeatureRequestDetail(requestId: string | undefined) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: ['feature-request', requestId],
        queryFn: async () => {
            if (!requestId) throw new Error('Request ID required');
            const result = await getFeatureRequest({ requestId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.featureRequest;
        },
        enabled: !!requestId,
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
        onError: (err, _variables, context) => {
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
        onError: (err, _variables, context) => {
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
        onError: (err, _variables, context) => {
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
        mutationFn: async ({ requestId, content, commentId }: { requestId: string; content: string; commentId: string }) => {
            const result = await addAdminComment({ requestId, content, commentId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.featureRequest;
        },
        onMutate: async ({ requestId, content, commentId }) => {
            const detailKey = ['feature-request', requestId] as const;
            await queryClient.cancelQueries({ queryKey: featureRequestsBaseQueryKey });
            await queryClient.cancelQueries({ queryKey: detailKey });
            const previous = queryClient.getQueriesData({ queryKey: featureRequestsBaseQueryKey });
            const previousDetail = queryClient.getQueryData(detailKey);

            // Optimistically add the comment
            const newComment = {
                id: commentId,
                authorId: 'admin',
                authorName: 'Admin',
                isAdmin: true,
                content,
                createdAt: new Date().toISOString(),
            };

            const addComment = (request: { comments?: unknown[] } & Record<string, unknown>) => ({
                ...request,
                comments: [...(request.comments || []), newComment],
            });

            queryClient.setQueriesData({ queryKey: featureRequestsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((request) =>
                    request._id === requestId ? addComment(request) : request
                );
            });

            // Also update the single-item detail cache the detail page reads from
            queryClient.setQueryData(detailKey, (old) =>
                old && typeof old === 'object' ? addComment(old as Record<string, unknown>) : old
            );

            return { previous, previousDetail, requestId };
        },
        onError: (err, _variables, context) => {
            if (!context) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            queryClient.setQueryData(['feature-request', context.requestId], context.previousDetail);
            toast.error('Failed to add comment');
        },
        onSuccess: () => {},
        onSettled: () => {},
    });
}

/**
 * Hook to create a new feature request (admin only)
 */
export function useCreateFeatureRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: CreateFeatureRequestRequest) => {
            const result = await createFeatureRequest(params);
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.featureRequest;
        },
        onMutate: async (params) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: featureRequestsBaseQueryKey });

            // Get current data for rollback
            const previous = queryClient.getQueriesData({ queryKey: featureRequestsBaseQueryKey });

            // Optimistically update - add new request to cache
            queryClient.setQueriesData({ queryKey: featureRequestsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;

                const newRequest = {
                    _id: generateId(),
                    ...params,
                    status: 'new',
                    priority: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    comments: [],
                };

                return [newRequest, ...old];
            });

            // Show success toast immediately
            toast.success('Feature request created successfully');
            return { previous };
        },
        onError: (err, _variables, context) => {
            // Rollback on error
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to create feature request');
        },
        onSuccess: () => {}, // EMPTY - never update from server response
        onSettled: () => {}, // EMPTY - never invalidateQueries
    });
}
