import { BulkDeleteActivityRequest, BulkDeleteActivityResponse } from '../types';
import { setLogs } from '@/server/database';
import type { ApiHandlerContext } from '@/apis/types';

export async function bulkDeleteActivity(
    request: BulkDeleteActivityRequest,
    context: ApiHandlerContext
): Promise<BulkDeleteActivityResponse> {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.activityIds || request.activityIds.length === 0) {
            return { error: 'Activity IDs are required' };
        }

        // Limit bulk delete to 100 items for safety
        if (request.activityIds.length > 100) {
            return { error: 'Cannot delete more than 100 items at once' };
        }

        // Delete the set logs (will verify userId ownership)
        const deletedCount = await setLogs.deleteSetLogsBulk(request.activityIds, context.userId);

        return { deletedCount };
    } catch (error) {
        console.error('Error bulk deleting activities:', error);
        return { error: 'Failed to delete activities' };
    }
}
