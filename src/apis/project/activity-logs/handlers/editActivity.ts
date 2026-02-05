import { EditActivityRequest, EditActivityResponse } from '../types';
import { setLogs } from '@/server/database';
import type { ApiHandlerContext } from '@/apis/types';

export async function editActivity(
    request: EditActivityRequest,
    context: ApiHandlerContext
): Promise<EditActivityResponse> {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        if (!request.activityId) {
            return { error: 'Activity ID is required' };
        }

        if (!request.completedAt) {
            return { error: 'Completed date is required' };
        }

        // Parse and validate date
        const completedAt = new Date(request.completedAt);
        if (isNaN(completedAt.getTime())) {
            return { error: 'Invalid date format' };
        }

        // Update the set log date (will verify userId ownership)
        const updated = await setLogs.updateSetLogDate(
            request.activityId,
            context.userId,
            completedAt
        );

        if (!updated) {
            return { error: 'Activity not found or unauthorized' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error editing activity:', error);
        return { error: 'Failed to edit activity' };
    }
}
