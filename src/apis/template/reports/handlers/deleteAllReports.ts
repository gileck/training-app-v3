import { DeleteAllReportsRequest, DeleteAllReportsResponse } from '../types';
import { findReports, deleteAllReports as deleteAllReportsFromDb } from '@/server/database/collections/template/reports';
import { ApiHandlerContext } from '@/apis/types';
import { fileStorageAPI } from '@/server/blob';

export const deleteAllReports = async (
    request: DeleteAllReportsRequest,
    context: ApiHandlerContext
): Promise<DeleteAllReportsResponse> => {
    try {
        // Get all reports to find screenshots
        const allReports = await findReports();

        // Collect all screenshot URLs to delete
        const screenshotUrls = allReports
            .filter(report => report.screenshot)
            .map(report => report.screenshot!)
            .filter(url => url.startsWith('http://') || url.startsWith('https://'));

        // Delete all screenshots from storage in parallel
        const deleteResults = await Promise.allSettled(
            screenshotUrls.map(url => fileStorageAPI.delete(url))
        );
        const deletedFilesCount = deleteResults.filter(r => r.status === 'fulfilled').length;
        const failedDeletes = deleteResults.filter(r => r.status === 'rejected');
        if (failedDeletes.length > 0) {
            console.error(`Failed to delete ${failedDeletes.length} screenshots from storage`);
        }

        // Delete all reports from database
        const deletedCount = await deleteAllReportsFromDb();

        console.log(`Deleted ${deletedCount} reports and ${deletedFilesCount} files from storage by user ${context.userId || 'anonymous'}`);
        
        return { deletedCount };
    } catch (error) {
        console.error('Error deleting all reports:', error);
        return { 
            error: error instanceof Error ? error.message : 'Failed to delete all reports' 
        };
    }
};
