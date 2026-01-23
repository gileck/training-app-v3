import { API_GET_REPORTS } from '../index';
import { GetReportsRequest, GetReportsResponse } from '../types';
import { reports } from '@/server/database';
import { ReportFilters } from '@/server/database/collections/reports/types';
import { toStringId } from '@/server/utils';

export const getReports = async (
    request: GetReportsRequest
): Promise<GetReportsResponse> => {
    try {
        const filters: ReportFilters = {};
        
        if (request.type) {
            filters.type = request.type;
        }
        
        if (request.status) {
            filters.status = request.status;
        }
        
        if (request.startDate) {
            filters.startDate = new Date(request.startDate);
        }
        
        if (request.endDate) {
            filters.endDate = new Date(request.endDate);
        }

        const sortBy = request.sortBy || 'createdAt';
        const sortOrder = request.sortOrder || 'desc';

        const reportDocs = await reports.findReports(filters, sortBy, sortOrder);

        // Convert to client format
        // Handle legacy reports that may not have all date fields
        const reportsClient = reportDocs.map((doc) => {
            const createdAt = doc.createdAt?.toISOString() ?? new Date().toISOString();
            const updatedAt = doc.updatedAt?.toISOString() ?? createdAt;
            const firstOccurrence = doc.firstOccurrence?.toISOString() ?? createdAt;
            const lastOccurrence = doc.lastOccurrence?.toISOString() ?? firstOccurrence;

            return {
                _id: toStringId(doc._id),
                type: doc.type,
                status: doc.status,
                description: doc.description,
                screenshot: doc.screenshot,
                sessionLogs: doc.sessionLogs,
                userInfo: doc.userInfo,
                browserInfo: doc.browserInfo,
                route: doc.route,
                networkStatus: doc.networkStatus,
                stackTrace: doc.stackTrace,
                errorMessage: doc.errorMessage,
                category: doc.category,
                performanceEntries: doc.performanceEntries,
                investigation: doc.investigation ? {
                    ...doc.investigation,
                    investigatedAt: doc.investigation.investigatedAt?.toISOString() ?? createdAt,
                } : undefined,
                duplicateOf: doc.duplicateOf ? toStringId(doc.duplicateOf) : undefined,
                occurrenceCount: doc.occurrenceCount ?? 1,
                firstOccurrence,
                lastOccurrence,
                errorKey: doc.errorKey,
                githubIssueUrl: doc.githubIssueUrl,
                githubIssueNumber: doc.githubIssueNumber,
                githubProjectItemId: doc.githubProjectItemId,
                githubPrUrl: doc.githubPrUrl,
                githubPrNumber: doc.githubPrNumber,
                createdAt,
                updatedAt,
            };
        });

        return { reports: reportsClient };
    } catch (error: unknown) {
        console.error("Get reports error:", error);
        return { error: error instanceof Error ? error.message : "Failed to get reports" };
    }
};

export { API_GET_REPORTS };

