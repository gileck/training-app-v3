import { API_APPROVE_BUG_REPORT } from '../index';
import { ApproveBugReportRequest, ApproveBugReportResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { approveBugReport as approveBugReportService } from '@/server/github-sync';

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

        const result = await approveBugReportService(request.reportId);

        if (!result.success) {
            return { error: result.error || 'Failed to approve bug report' };
        }

        return {
            success: true,
            githubIssueUrl: result.githubResult?.issueUrl,
            githubIssueNumber: result.githubResult?.issueNumber,
            githubProjectItemId: result.githubResult?.projectItemId,
        };
    } catch (error: unknown) {
        console.error('Approve bug report error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to approve bug report' };
    }
};

export { API_APPROVE_BUG_REPORT };
