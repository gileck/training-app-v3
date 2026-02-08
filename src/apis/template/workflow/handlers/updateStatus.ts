import { ApiHandlerContext } from '@/apis/types';
import { findWorkflowItemById, updateWorkflowFields } from '@/server/database/collections/template/workflow-items';
import { STATUSES } from '@/server/project-management/config';
import { isObjectIdFormat } from '@/server/utils';
import type { UpdateWorkflowStatusRequest, UpdateWorkflowStatusResponse } from '../types';

const VALID_STATUSES = new Set<string>(Object.values(STATUSES));

export async function updateStatus(
    params: UpdateWorkflowStatusRequest,
    context: ApiHandlerContext
): Promise<UpdateWorkflowStatusResponse> {
    if (!context.isAdmin) {
        return { error: 'Admin access required' };
    }

    const { itemId, status } = params;

    if (!itemId || !isObjectIdFormat(itemId)) {
        return { error: 'Invalid item ID' };
    }

    if (!status || !VALID_STATUSES.has(status)) {
        return { error: `Invalid status: ${status}` };
    }

    try {
        const item = await findWorkflowItemById(itemId);
        if (!item) {
            return { error: 'Workflow item not found' };
        }

        await updateWorkflowFields(itemId, { workflowStatus: status });

        return { success: true };
    } catch (error) {
        console.error('Error updating workflow status:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to update status',
        };
    }
}
