import { API_UPDATE_REPORT_STATUS } from '../index';
import { UpdateReportStatusRequest, UpdateReportStatusResponse } from '../types';
import { reports } from '@/server/database';
import { toStringId } from '@/server/utils';

export const updateReportStatus = async (
    request: UpdateReportStatusRequest
): Promise<UpdateReportStatusResponse> => {
    try {
        if (!request.reportId) {
            return { error: "Report ID is required" };
        }

        if (!request.status) {
            return { error: "Status is required" };
        }

        const validStatuses = ['new', 'investigating', 'resolved', 'closed'];
        if (!validStatuses.includes(request.status)) {
            return { error: "Invalid status" };
        }

        const reportDoc = await reports.updateReportStatus(request.reportId, request.status);

        if (!reportDoc) {
            return { error: "Report not found" };
        }

        // Convert to client format
        // Handle legacy reports that may not have all date fields
        const createdAt = reportDoc.createdAt?.toISOString() ?? new Date().toISOString();
        const updatedAt = reportDoc.updatedAt?.toISOString() ?? createdAt;
        const firstOccurrence = reportDoc.firstOccurrence?.toISOString() ?? createdAt;
        const lastOccurrence = reportDoc.lastOccurrence?.toISOString() ?? firstOccurrence;

        const reportClient = {
            _id: toStringId(reportDoc._id),
            type: reportDoc.type,
            status: reportDoc.status,
            description: reportDoc.description,
            screenshot: reportDoc.screenshot,
            sessionLogs: reportDoc.sessionLogs,
            userInfo: reportDoc.userInfo,
            browserInfo: reportDoc.browserInfo,
            route: reportDoc.route,
            networkStatus: reportDoc.networkStatus,
            stackTrace: reportDoc.stackTrace,
            errorMessage: reportDoc.errorMessage,
            category: reportDoc.category,
            performanceEntries: reportDoc.performanceEntries,
            investigation: reportDoc.investigation ? {
                ...reportDoc.investigation,
                investigatedAt: reportDoc.investigation.investigatedAt?.toISOString() ?? createdAt,
            } : undefined,
            duplicateOf: reportDoc.duplicateOf ? toStringId(reportDoc.duplicateOf) : undefined,
            occurrenceCount: reportDoc.occurrenceCount ?? 1,
            firstOccurrence,
            lastOccurrence,
            errorKey: reportDoc.errorKey,
            githubIssueUrl: reportDoc.githubIssueUrl,
            githubIssueNumber: reportDoc.githubIssueNumber,
            githubProjectItemId: reportDoc.githubProjectItemId,
            createdAt,
            updatedAt,
        };

        return { report: reportClient };
    } catch (error: unknown) {
        console.error("Update report status error:", error);
        return { error: error instanceof Error ? error.message : "Failed to update report status" };
    }
};

export { API_UPDATE_REPORT_STATUS };

