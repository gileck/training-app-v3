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
    approveFeatureRequest,
    getGitHubStatus,
    getGitHubStatuses,
    updateGitHubStatus,
    updateGitHubReviewStatus,
    clearGitHubReviewStatus,
    createFeatureRequest,
    getGitHubIssueDetails,
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
            await queryClient.cancelQueries({ queryKey: featureRequestsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: featureRequestsBaseQueryKey });

            // Optimistically add the comment
            const newComment = {
                id: commentId,
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
        onError: (err, _variables, context) => {
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

export function useApproveFeatureRequest() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (requestId: string) => {
            const result = await approveFeatureRequest({ requestId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onMutate: async (requestId) => {
            await queryClient.cancelQueries({ queryKey: featureRequestsBaseQueryKey });
            const previous = queryClient.getQueriesData({ queryKey: featureRequestsBaseQueryKey });

            // Optimistically update status to in_progress
            queryClient.setQueriesData({ queryKey: featureRequestsBaseQueryKey }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((request) =>
                    request._id === requestId
                        ? { ...request, status: 'in_progress' as FeatureRequestStatus }
                        : request
                );
            });

            return { previous };
        },
        onError: (err, _variables, context) => {
            if (!context?.previous) return;
            for (const [key, data] of context.previous) {
                queryClient.setQueryData(key, data);
            }
            toast.error('Failed to approve feature request');
        },
        onSuccess: (data) => {
            if (data.githubIssueUrl) {
                toast.success(`Approved! GitHub Issue #${data.githubIssueNumber} created`);
            } else {
                toast.success('Feature request approved');
            }
        },
        onSettled: () => {},
    });
}

/**
 * Hook to fetch GitHub Project status for a feature request
 * Only enabled when there's a GitHub project item ID
 */
// GitHub status changes frequently, use shorter staleTime when SWR is enabled
const GITHUB_STATUS_STALE_TIME = 30_000;

export function useGitHubStatus(requestId: string | null, enabled: boolean = true) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: ['github-status', requestId],
        queryFn: async () => {
            if (!requestId) return null;
            const result = await getGitHubStatus({ requestId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        enabled: enabled && !!requestId,
        ...queryDefaults,
        staleTime: queryDefaults.staleTime > 0 ? GITHUB_STATUS_STALE_TIME : 0,
        refetchOnWindowFocus: true,
    });
}

/**
 * Hook to fetch GitHub Project statuses for multiple feature requests
 * Used by the list view to get all statuses for filtering
 */
export function useBatchGitHubStatuses(requestIds: string[]) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: ['github-statuses-batch', requestIds],
        queryFn: async () => {
            if (requestIds.length === 0) return {};

            // Fetch all statuses in parallel
            const results = await Promise.allSettled(
                requestIds.map(async (requestId) => {
                    const result = await getGitHubStatus({ requestId });
                    return { requestId, data: result.data };
                })
            );

            // Build map from results, handling errors gracefully
            const statusMap: Record<string, { status: string; reviewStatus: string | null } | undefined> = {};

            results.forEach((result, index) => {
                const requestId = requestIds[index];
                if (result.status === 'fulfilled' && !result.value.data.error) {
                    statusMap[requestId] = {
                        status: result.value.data.status || '',
                        reviewStatus: result.value.data.reviewStatus || null,
                    };
                }
                // On error, don't add to map - will fall back to DB status
            });

            return statusMap;
        },
        enabled: requestIds.length > 0,
        ...queryDefaults,
        staleTime: queryDefaults.staleTime > 0 ? GITHUB_STATUS_STALE_TIME : 0,
        refetchOnWindowFocus: true,
        // Handle rate limit errors gracefully
        retry: (failureCount, error) => {
            // Don't retry on rate limit errors
            if (error instanceof Error && error.message.includes('rate limit')) {
                return false;
            }
            return failureCount < 2;
        },
    });
}

/**
 * Hook to fetch available GitHub Project statuses
 */
export function useGitHubStatuses() {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: ['github-statuses'],
        queryFn: async () => {
            const result = await getGitHubStatuses();
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        ...queryDefaults,
    });
}

/**
 * Hook to update GitHub Project status
 */
export function useUpdateGitHubStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
            const result = await updateGitHubStatus({ requestId, status });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onMutate: async ({ requestId, status }) => {
            await queryClient.cancelQueries({ queryKey: ['github-status', requestId] });
            const previous = queryClient.getQueryData(['github-status', requestId]);
            queryClient.setQueryData(['github-status', requestId], (old: unknown) => ({
                ...(old as Record<string, unknown>),
                status,
            }));
            return { previous, requestId };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous !== undefined) {
                queryClient.setQueryData(['github-status', context.requestId], context.previous);
            }
            toast.error('Failed to update GitHub status');
        },
        onSuccess: () => {
            toast.success('GitHub status updated');
        },
        onSettled: () => {},
    });
}

/**
 * Hook to update GitHub Project review status
 */
export function useUpdateGitHubReviewStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestId, reviewStatus }: { requestId: string; reviewStatus: string }) => {
            const result = await updateGitHubReviewStatus({ requestId, reviewStatus });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onMutate: async ({ requestId, reviewStatus }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['github-status', requestId] });

            // Snapshot previous value
            const previous = queryClient.getQueryData(['github-status', requestId]);

            // Optimistically update UI
            queryClient.setQueryData(['github-status', requestId], (old: unknown) => ({
                ...(old as Record<string, unknown>),
                reviewStatus
            }));

            return { previous };
        },
        onError: (err, { requestId }, context) => {
            // Rollback on error
            if (context?.previous) {
                queryClient.setQueryData(['github-status', requestId], context.previous);
            }
            toast.error('Failed to update GitHub review status');
        },
        onSuccess: () => {
            toast.success('GitHub review status updated');
            // No invalidateQueries needed - UI already updated optimistically
        },
    });
}

/**
 * Hook to clear GitHub Project review status
 */
export function useClearGitHubReviewStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestId }: { requestId: string }) => {
            const result = await clearGitHubReviewStatus({ requestId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onMutate: async ({ requestId }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['github-status', requestId] });

            // Snapshot previous value
            const previous = queryClient.getQueryData(['github-status', requestId]);

            // Optimistically update UI - set reviewStatus to null
            queryClient.setQueryData(['github-status', requestId], (old: unknown) => ({
                ...(old as Record<string, unknown>),
                reviewStatus: null
            }));

            return { previous };
        },
        onError: (err, { requestId }, context) => {
            // Rollback on error
            if (context?.previous) {
                queryClient.setQueryData(['github-status', requestId], context.previous);
            }
            toast.error('Failed to clear GitHub review status');
        },
        onSuccess: () => {
            toast.success('GitHub review status cleared');
            // No invalidateQueries needed - UI already updated optimistically
        },
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
                    likes: 0,
                    githubIssueNumber: null,
                    githubStatus: null,
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

/**
 * Hook to fetch GitHub issue details including full description and linked PRs
 */
export function useGitHubIssueDetails(requestId: string | null, enabled: boolean = true) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: ['github-issue-details', requestId],
        queryFn: async () => {
            if (!requestId) return null;
            const result = await getGitHubIssueDetails({ requestId });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data.issueDetails;
        },
        enabled: enabled && !!requestId,
        ...queryDefaults,
    });
}
