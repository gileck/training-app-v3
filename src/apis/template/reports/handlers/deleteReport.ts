import { DeleteReportRequest, DeleteReportResponse } from '../types';
import { findReportById, deleteReport as deleteReportFromDb } from '@/server/database/collections/template/reports';
import { deleteWorkflowItemBySourceRef } from '@/server/database/collections/template/workflow-items';
import { ApiHandlerContext } from '@/apis/types';
import { isObjectIdFormat } from '@/server/utils';
import { fileStorageAPI } from '@/server/blob';

export const deleteReport = async (
    request: DeleteReportRequest,
    context: ApiHandlerContext
): Promise<DeleteReportResponse> => {
    try {
        const { reportId } = request;

        // Validate report ID format
        if (!isObjectIdFormat(reportId)) {
            return { error: 'Invalid report ID' };
        }

        // Find the report first to get screenshot URL
        const report = await findReportById(reportId);

        if (report) {
            // Delete screenshot from storage if it exists
            if (report.screenshot) {
                try {
                    // Check if it's a URL (not legacy base64)
                    if (report.screenshot.startsWith('http://') || report.screenshot.startsWith('https://')) {
                        await fileStorageAPI.delete(report.screenshot);
                        console.log(`Deleted screenshot from storage: ${report.screenshot}`);
                    }
                } catch (error) {
                    console.error('Failed to delete screenshot from storage:', error);
                    // Continue with report deletion even if storage deletion fails
                }
            }

            // Delete the report from database
            const result = await deleteReportFromDb(reportId);

            if (!result) {
                return { error: 'Failed to delete report' };
            }
        }

        // Always clean up the associated workflow item (handles orphaned items)
        const workflowDeleted = await deleteWorkflowItemBySourceRef('reports', reportId);

        if (!report && !workflowDeleted) {
            return { error: 'Report not found' };
        }

        console.log(`Report ${reportId} deleted by user ${context.userId || 'anonymous'}${workflowDeleted ? ' (workflow item also removed)' : ''}`);

        return { success: true };
    } catch (error) {
        console.error('Error deleting report:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to delete report'
        };
    }
};

