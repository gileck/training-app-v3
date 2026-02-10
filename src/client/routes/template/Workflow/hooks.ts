/**
 * Workflow Route Hooks
 *
 * React Query hooks for fetching workflow items and executing actions.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listWorkflowItems, updateWorkflowStatus, executeWorkflowAction } from '@/apis/template/workflow/client';
import { useQueryDefaults } from '@/client/query';
import type { WorkflowItem, WorkflowActionRequest } from '@/apis/template/workflow/types';

const workflowItemsQueryKey = ['workflow-items'] as const;

export function useWorkflowItems() {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: workflowItemsQueryKey,
        queryFn: async () => {
            const result = await listWorkflowItems();
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return {
                pendingItems: result.data.pendingItems || [],
                workflowItems: result.data.workflowItems || [],
            };
        },
        ...queryDefaults,
        refetchInterval: 30000,
    });
}

export function useUpdateWorkflowStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
            const result = await updateWorkflowStatus({ itemId, status });
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onMutate: async ({ itemId, status }) => {
            await queryClient.cancelQueries({ queryKey: workflowItemsQueryKey });

            const previous = queryClient.getQueryData<{
                pendingItems: unknown[];
                workflowItems: WorkflowItem[];
            }>(workflowItemsQueryKey);

            if (previous) {
                queryClient.setQueryData(workflowItemsQueryKey, {
                    ...previous,
                    workflowItems: previous.workflowItems.map((item) =>
                        item.id === itemId ? { ...item, status } : item
                    ),
                });
            }

            return { previous };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.previous) {
                queryClient.setQueryData(workflowItemsQueryKey, ctx.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: workflowItemsQueryKey });
        },
    });
}

export function useWorkflowAction() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (params: WorkflowActionRequest) => {
            const result = await executeWorkflowAction(params);
            if (result.data.error) {
                throw new Error(result.data.error);
            }
            return result.data;
        },
        onMutate: async ({ action, issueNumber, originalAction }: WorkflowActionRequest) => {
            await queryClient.cancelQueries({ queryKey: workflowItemsQueryKey });

            const previous = queryClient.getQueryData<{
                pendingItems: unknown[];
                workflowItems: WorkflowItem[];
            }>(workflowItemsQueryKey);

            // Optimistic update based on action type
            if (previous) {
                queryClient.setQueryData(workflowItemsQueryKey, {
                    ...previous,
                    workflowItems: previous.workflowItems.map((item) => {
                        if (item.content?.number !== issueNumber) return item;

                        switch (action) {
                            case 'review-approve':
                                return { ...item, reviewStatus: 'Approved' };
                            case 'review-changes':
                                return { ...item, reviewStatus: 'Request Changes' };
                            case 'review-reject':
                                return { ...item, reviewStatus: 'Rejected' };
                            case 'request-changes-pr':
                                return { ...item, status: 'Ready for development', reviewStatus: 'Request Changes' };
                            case 'clarification-received':
                                return { ...item, reviewStatus: 'Clarification Received' };
                            case 'mark-done':
                                return { ...item, status: 'Done', reviewStatus: null };
                            case 'merge-design-pr':
                                return { ...item, reviewStatus: null };
                            case 'merge-pr':
                                return { ...item, reviewStatus: null };
                            case 'merge-final-pr':
                                return { ...item, status: 'Done', reviewStatus: null };
                            case 'revert-pr':
                                return {
                                    ...item,
                                    reviewStatus: 'Request Changes',
                                    prData: { ...item.prData, lastMergedPrNumber: undefined, lastMergedPrPhase: undefined },
                                };
                            case 'merge-revert-pr':
                                return {
                                    ...item,
                                    reviewStatus: null,
                                    prData: { ...item.prData, revertPrNumber: undefined },
                                };
                            case 'undo-action':
                                return {
                                    ...item,
                                    ...(originalAction === 'request-changes-pr' ? { status: 'PR Review' } : {}),
                                    reviewStatus: null,
                                };
                            default:
                                return item;
                        }
                    }),
                });
            }

            return { previous };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.previous) {
                queryClient.setQueryData(workflowItemsQueryKey, ctx.previous);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: workflowItemsQueryKey });
        },
    });
}
