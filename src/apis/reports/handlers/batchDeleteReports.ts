import { BatchDeleteReportsRequest, BatchDeleteReportsResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { getDb } from '@/server/database';
import { fileStorageAPI } from '@/server/blob';
import { ObjectId } from 'mongodb';

export const batchDeleteReports = async (
    request: BatchDeleteReportsRequest,
    context: ApiHandlerContext
): Promise<BatchDeleteReportsResponse> => {
    try {
        const { reportIds } = request;

        if (!reportIds || reportIds.length === 0) {
            return { error: 'No report IDs provided' };
        }

        const db = await getDb();
        const collection = db.collection('reports');

        // Convert string IDs to ObjectIds
        const objectIds = reportIds.map(id => new ObjectId(id));

        // First, get all reports to find screenshots
        const reports = await collection.find({ _id: { $in: objectIds } }).toArray();

        // Collect all screenshot URLs to delete
        const screenshotUrls = reports
            .filter(report => report.screenshot)
            .map(report => report.screenshot as string)
            .filter(url => url.startsWith('http://') || url.startsWith('https://'));

        // Delete all screenshots from storage in parallel
        if (screenshotUrls.length > 0) {
            const deleteResults = await Promise.allSettled(
                screenshotUrls.map(url => fileStorageAPI.delete(url))
            );
            const deletedFilesCount = deleteResults.filter(r => r.status === 'fulfilled').length;
            const failedDeletes = deleteResults.filter(r => r.status === 'rejected');
            if (failedDeletes.length > 0) {
                console.error(`Failed to delete ${failedDeletes.length} screenshots from storage`);
            }
            console.log(`Deleted ${deletedFilesCount} screenshots from storage`);
        }

        // Delete all reports from database
        const result = await collection.deleteMany({ _id: { $in: objectIds } });

        console.log(`Batch deleted ${result.deletedCount} reports by user ${context.userId || 'anonymous'}`);

        return { deletedCount: result.deletedCount };
    } catch (error) {
        console.error('Error batch deleting reports:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to batch delete reports'
        };
    }
};
