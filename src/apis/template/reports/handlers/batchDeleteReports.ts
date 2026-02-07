import { BatchDeleteReportsRequest, BatchDeleteReportsResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { reports } from '@/server/database';
import { fileStorageAPI } from '@/server/blob';

export const batchDeleteReports = async (
    request: BatchDeleteReportsRequest,
    context: ApiHandlerContext
): Promise<BatchDeleteReportsResponse> => {
    try {
        const { reportIds } = request;

        if (!reportIds || reportIds.length === 0) {
            return { error: 'No report IDs provided' };
        }

        // First, get all reports to find screenshots
        const reportDocs = await reports.findReportsByIds(reportIds);

        // Collect all screenshot URLs to delete
        const screenshotUrls = reportDocs
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
        const deletedCount = await reports.batchDeleteByIds(reportIds);

        console.log(`Batch deleted ${deletedCount} reports by user ${context.userId || 'anonymous'}`);

        return { deletedCount };
    } catch (error) {
        console.error('Error batch deleting reports:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to batch delete reports'
        };
    }
};
