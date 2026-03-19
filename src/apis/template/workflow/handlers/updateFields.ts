/**
 * Update Fields Handler
 *
 * Admin-only handler to update priority, size, and complexity on a workflow item.
 */

import { ApiHandlerContext } from '@/apis/types';
import { updateWorkflowFields } from '@/server/database/collections/template/workflow-items/workflow-items';
import { isObjectIdFormat } from '@/server/template/utils';
import type { UpdateWorkflowFieldsRequest, UpdateWorkflowFieldsResponse } from '../types';

const VALID_PRIORITIES = new Set(['critical', 'high', 'medium', 'low']);
const VALID_SIZES = new Set(['XS', 'S', 'M', 'L', 'XL']);
const VALID_COMPLEXITIES = new Set(['High', 'Medium', 'Low']);

export async function updateFields(
    params: UpdateWorkflowFieldsRequest,
    context: ApiHandlerContext
): Promise<UpdateWorkflowFieldsResponse> {
    if (!context.isAdmin) {
        return { error: 'Admin access required' };
    }

    const { itemId, fields } = params;

    if (!itemId || !isObjectIdFormat(itemId)) {
        return { error: 'Invalid item ID' };
    }

    if (!fields || typeof fields !== 'object') {
        return { error: 'Fields object is required' };
    }

    // Validate field values (null means clear)
    if (fields.priority !== undefined && fields.priority !== null && !VALID_PRIORITIES.has(fields.priority)) {
        return { error: `Invalid priority: ${fields.priority}` };
    }
    if (fields.size !== undefined && fields.size !== null && !VALID_SIZES.has(fields.size)) {
        return { error: `Invalid size: ${fields.size}` };
    }
    if (fields.complexity !== undefined && fields.complexity !== null && !VALID_COMPLEXITIES.has(fields.complexity)) {
        return { error: `Invalid complexity: ${fields.complexity}` };
    }
    try {
        await updateWorkflowFields(itemId, fields);
        return { success: true };
    } catch (error) {
        console.error('Error updating workflow fields:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to update fields',
        };
    }
}
