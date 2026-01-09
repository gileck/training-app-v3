import { API_CREATE_REPORT } from '../index';
import { CreateReportRequest, CreateReportResponse } from '../types';
import { reports } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { fileStorageAPI } from '@/server/blob';
import { toStringId } from '@/server/utils';

export const createReport = async (
    request: CreateReportRequest,
    context: ApiHandlerContext
): Promise<CreateReportResponse> => {
    try {
        const now = new Date();
        
        // Build user info from context if available
        const userInfo = request.userInfo || (context.userId ? {
            userId: context.userId,
        } : undefined);

        // Upload screenshot to file storage if provided as base64
        let screenshotUrl: string | undefined;
        if (request.screenshot && request.screenshot.startsWith('data:')) {
            try {
                const result = await fileStorageAPI.uploadBase64Image(request.screenshot, {
                    folder: 'reports/screenshots',
                });
                screenshotUrl = result.url;
            } catch (uploadError) {
                console.error(`Failed to upload screenshot to ${fileStorageAPI.getProviderName()}:`, uploadError);
                // Continue without screenshot rather than failing the report
            }
        }

        const reportData = {
            type: request.type,
            status: 'new' as const,
            description: request.description,
            screenshot: screenshotUrl, // Store URL instead of base64
            sessionLogs: request.sessionLogs || [],
            userInfo,
            browserInfo: request.browserInfo,
            route: request.route,
            networkStatus: request.networkStatus,
            stackTrace: request.stackTrace,
            errorMessage: request.errorMessage,
            category: request.category,
            performanceEntries: request.performanceEntries,
            createdAt: now,
            updatedAt: now,
        };

        const newReport = await reports.createReport(reportData);

        // Convert to client format
        const reportClient = {
            _id: toStringId(newReport._id),
            type: newReport.type,
            status: newReport.status,
            description: newReport.description,
            screenshot: newReport.screenshot,
            sessionLogs: newReport.sessionLogs,
            userInfo: newReport.userInfo,
            browserInfo: newReport.browserInfo,
            route: newReport.route,
            networkStatus: newReport.networkStatus,
            stackTrace: newReport.stackTrace,
            errorMessage: newReport.errorMessage,
            category: newReport.category,
            performanceEntries: newReport.performanceEntries,
            investigation: undefined, // New reports don't have investigation
            createdAt: newReport.createdAt.toISOString(),
            updatedAt: newReport.updatedAt.toISOString(),
        };

        return { report: reportClient };
    } catch (error: unknown) {
        console.error("Create report error:", error);
        return { error: error instanceof Error ? error.message : "Failed to create report" };
    }
};

export { API_CREATE_REPORT };
