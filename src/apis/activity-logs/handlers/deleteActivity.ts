import { DeleteActivityRequest, DeleteActivityResponse } from '../types';
import { setLogs } from '@/server/database';
import type { ApiHandlerContext } from '@/apis/types';

export async function deleteActivity(
    request: DeleteActivityRequest,
    context: ApiHandlerContext
): Promise<DeleteActivityResponse> {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.activityId) {
            return { error: 'Activity ID is required' };
        }

        // Delete the set log (will verify userId ownership)
        const deleted = await setLogs.deleteSetLog(request.activityId, context.userId);

        if (!deleted) {
            return { error: 'Activity not found or already deleted' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error deleting activity:', error);
        return { error: 'Failed to delete activity' };
    }
}

