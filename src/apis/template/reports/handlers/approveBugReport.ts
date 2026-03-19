import { API_APPROVE_BUG_REPORT } from '../index';
import { ApproveBugReportRequest, ApproveBugReportResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { approveWorkflowItem } from '@/server/template/workflow-service';

export const approveBugReport = async (
    request: ApproveBugReportRequest,
    context: ApiHandlerContext
): Promise<ApproveBugReportResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.reportId) {
            return { error: 'Report ID is required' };
        }

        const result = await approveWorkflowItem(
            { id: request.reportId, type: 'bug' },
            request.toBacklog ? { initialRoute: 'backlog' } : undefined
        );

        if (!result.success) {
            return { error: result.error || 'Failed to approve bug report' };
        }

        return {
            success: true,
            githubIssueUrl: result.issueUrl,
            githubIssueNumber: result.issueNumber,
            needsRouting: result.needsRouting,
        };
    } catch (error: unknown) {
        console.error('Approve bug report error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to approve bug report' };
    }
};

export { API_APPROVE_BUG_REPORT };
