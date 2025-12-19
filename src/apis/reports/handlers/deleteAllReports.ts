import { DeleteAllReportsRequest, DeleteAllReportsResponse } from '../types';
import { findReports, deleteAllReports as deleteAllReportsFromDb } from '@/server/database/collections/reports';
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

        // Delete all screenshots from storage
        let deletedFilesCount = 0;
        for (const url of screenshotUrls) {
            try {
                await fileStorageAPI.delete(url);
                deletedFilesCount++;
            } catch (error) {
                console.error(`Failed to delete screenshot from storage: ${url}`, error);
                // Continue with next file
            }
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
