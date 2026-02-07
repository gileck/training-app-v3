import { BatchUpdateStatusRequest, BatchUpdateStatusResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { reports } from '@/server/database';

export const batchUpdateStatus = async (
    request: BatchUpdateStatusRequest,
    context: ApiHandlerContext
): Promise<BatchUpdateStatusResponse> => {
    try {
        const { reportIds, status } = request;

        if (!reportIds || reportIds.length === 0) {
            return { error: 'No report IDs provided' };
        }

        const modifiedCount = await reports.batchUpdateStatuses(reportIds, status);

        console.log(`Batch updated ${modifiedCount} reports to status "${status}" by user ${context.userId || 'anonymous'}`);

        return { updatedCount: modifiedCount };
    } catch (error) {
        console.error('Error batch updating report status:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to batch update reports'
        };
    }
};
