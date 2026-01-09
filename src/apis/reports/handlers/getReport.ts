import { API_GET_REPORT } from '../index';
import { GetReportRequest, GetReportResponse } from '../types';
import { reports } from '@/server/database';
import { toStringId } from '@/server/utils';

export const getReport = async (
    request: GetReportRequest
): Promise<GetReportResponse> => {
    try {
        if (!request.reportId) {
            return { error: "Report ID is required" };
        }

        const reportDoc = await reports.findReportById(request.reportId);

        if (!reportDoc) {
            return { error: "Report not found" };
        }

        // Convert to client format
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
                investigatedAt: reportDoc.investigation.investigatedAt.toISOString(),
            } : undefined,
            createdAt: reportDoc.createdAt.toISOString(),
            updatedAt: reportDoc.updatedAt.toISOString(),
        };

        return { report: reportClient };
    } catch (error: unknown) {
        console.error("Get report error:", error);
        return { error: error instanceof Error ? error.message : "Failed to get report" };
    }
};

export { API_GET_REPORT };

