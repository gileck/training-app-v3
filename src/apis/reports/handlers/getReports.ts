import { API_GET_REPORTS } from '../index';
import { GetReportsRequest, GetReportsResponse } from '../types';
import { reports } from '@/server/database';
import { ReportFilters } from '@/server/database/collections/reports/types';

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
        const reportsClient = reportDocs.map((doc) => ({
            _id: doc._id.toHexString(),
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
            createdAt: doc.createdAt.toISOString(),
            updatedAt: doc.updatedAt.toISOString(),
        }));

        return { reports: reportsClient };
    } catch (error: unknown) {
        console.error("Get reports error:", error);
        return { error: error instanceof Error ? error.message : "Failed to get reports" };
    }
};

export { API_GET_REPORTS };

