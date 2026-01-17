import { BatchUpdateStatusRequest, BatchUpdateStatusResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { getDb } from '@/server/database';
import { ObjectId } from 'mongodb';

export const batchUpdateStatus = async (
    request: BatchUpdateStatusRequest,
    context: ApiHandlerContext
): Promise<BatchUpdateStatusResponse> => {
    try {
        const { reportIds, status } = request;

        if (!reportIds || reportIds.length === 0) {
            return { error: 'No report IDs provided' };
        }

        const db = await getDb();
        const collection = db.collection('reports');

        // Convert string IDs to ObjectIds
        const objectIds = reportIds.map(id => new ObjectId(id));

        // Update all reports in a single operation
        const result = await collection.updateMany(
            { _id: { $in: objectIds } },
            {
                $set: {
                    status,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`Batch updated ${result.modifiedCount} reports to status "${status}" by user ${context.userId || 'anonymous'}`);

        return { updatedCount: result.modifiedCount };
    } catch (error) {
        console.error('Error batch updating report status:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to batch update reports'
        };
    }
};
