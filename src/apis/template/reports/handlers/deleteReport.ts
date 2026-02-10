import { DeleteReportRequest, DeleteReportResponse } from '../types';
import { findReportById } from '@/server/database/collections/template/reports';
import { ApiHandlerContext } from '@/apis/types';
import { isObjectIdFormat } from '@/server/utils';
import { fileStorageAPI } from '@/server/blob';
import { deleteWorkflowItem } from '@/server/workflow-service';

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

        // Clean up screenshot from storage before deleting (UI-specific concern)
        const report = await findReportById(reportId);
        if (report?.screenshot) {
            try {
                if (report.screenshot.startsWith('http://') || report.screenshot.startsWith('https://')) {
                    await fileStorageAPI.delete(report.screenshot);
                    console.log(`Deleted screenshot from storage: ${report.screenshot}`);
                }
            } catch (error) {
                console.error('Failed to delete screenshot from storage:', error);
                // Continue with report deletion even if storage deletion fails
            }
        }

        const result = await deleteWorkflowItem({ id: reportId, type: 'bug' });

        if (!result.success) {
            return { error: result.error || 'Failed to delete report' };
        }

        console.log(`Report ${reportId} deleted by user ${context.userId || 'anonymous'}`);

        return { success: true };
    } catch (error) {
        console.error('Error deleting report:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to delete report'
        };
    }
};
