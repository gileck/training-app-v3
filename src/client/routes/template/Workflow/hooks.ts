/**
 * Workflow Route Hooks
 *
 * React Query hook for fetching workflow items (pending + pipeline).
 */

import { useQuery } from '@tanstack/react-query';
import { listWorkflowItems } from '@/apis/template/workflow/client';
import { useQueryDefaults } from '@/client/query';

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
    });
}
