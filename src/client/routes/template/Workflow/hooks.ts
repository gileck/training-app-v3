/**
 * Workflow Route Hooks
 *
 * React Query hook for fetching workflow items (pending + pipeline).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listWorkflowItems, updateWorkflowStatus } from '@/apis/template/workflow/client';
import { useQueryDefaults } from '@/client/query';
import type { WorkflowItem } from '@/apis/template/workflow/types';

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
