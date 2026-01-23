import { API_CREATE_REPORT } from '../index';
import { CreateReportRequest, CreateReportResponse } from '../types';
import { reports } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { fileStorageAPI } from '@/server/blob';
import { toStringId } from '@/server/utils';
import { sendNotificationToOwner } from '@/server/telegram';
import crypto from 'crypto';

/**
 * Generate error key for deduplication
 */
function generateErrorKey(request: CreateReportRequest): string {
    if (request.apiName && request.errorMessage) {
        // API error: use apiName + errorMessage
        return `api:${request.apiName}:${request.errorMessage}`;
    } else if (request.errorMessage) {
        // Runtime error: use errorMessage + first 200 chars of stack trace
        const stackPrefix = request.stackTrace?.slice(0, 200) || '';
        return `runtime:${request.errorMessage}:${stackPrefix}`;
    }
    // No error key if no errorMessage (user-submitted bugs)
    return '';
}

/**
 * Generate a secure approval token
 */
function generateApprovalToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the base URL for the app
 */
function getBaseUrl(): string {
    // Use VERCEL_URL in production, fallback to localhost
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    return 'http://localhost:3000';
}

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

        // Generate error key for deduplication (only for automatic error reports)
        const errorKey = request.errorKey || generateErrorKey(request);

        // Check for existing open report with same error key (deduplication)
        if (errorKey && request.type === 'error') {
            const existingReport = await reports.findOpenReportByErrorKey(errorKey);

            if (existingReport) {
                // Increment occurrence count and update lastOccurrence
                await reports.incrementReportOccurrence(existingReport._id);

                // Return the updated existing report
                const reportClient = {
                    _id: toStringId(existingReport._id),
                    type: existingReport.type,
                    status: existingReport.status,
                    description: existingReport.description,
                    screenshot: existingReport.screenshot,
                    sessionLogs: existingReport.sessionLogs,
                    userInfo: existingReport.userInfo,
                    browserInfo: existingReport.browserInfo,
                    route: existingReport.route,
                    networkStatus: existingReport.networkStatus,
                    stackTrace: existingReport.stackTrace,
                    errorMessage: existingReport.errorMessage,
                    category: existingReport.category,
                    performanceEntries: existingReport.performanceEntries,
                    investigation: existingReport.investigation ? {
                        ...existingReport.investigation,
                        investigatedAt: existingReport.investigation.investigatedAt.toISOString(),
                    } : undefined,
                    duplicateOf: existingReport.duplicateOf ? toStringId(existingReport.duplicateOf) : undefined,
                    occurrenceCount: existingReport.occurrenceCount + 1, // Reflect the increment
                    firstOccurrence: existingReport.firstOccurrence.toISOString(),
                    lastOccurrence: now.toISOString(), // Use current time
                    errorKey: existingReport.errorKey,
                    githubIssueUrl: existingReport.githubIssueUrl,
                    githubIssueNumber: existingReport.githubIssueNumber,
                    githubProjectItemId: existingReport.githubProjectItemId,
                    githubPrUrl: existingReport.githubPrUrl,
                    githubPrNumber: existingReport.githubPrNumber,
                    createdAt: existingReport.createdAt.toISOString(),
                    updatedAt: now.toISOString(),
                };

                return { report: reportClient };
            }
        }

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

        // Generate approval token for user-submitted bug reports
        const approvalToken = request.type === 'bug' ? generateApprovalToken() : undefined;

        // Create new report with deduplication fields
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
            errorKey: errorKey || undefined,
            approvalToken, // Add approval token for bug reports
            occurrenceCount: 1,
            firstOccurrence: now,
            lastOccurrence: now,
            createdAt: now,
            updatedAt: now,
        };

        const newReport = await reports.createReport(reportData);

        // Send Telegram notification for user-submitted bug reports (not automatic errors)
        if (request.type === 'bug' && request.description) {
            try {
                const baseUrl = getBaseUrl();
                const isHttps = baseUrl.startsWith('https://');

                const categoryLabel = request.category === 'performance' ? '⚡ Performance Issue' : '🐛 Bug Report';
                const routeInfo = request.route ? `\n📍 Route: ${request.route}` : '';
                const userIdentifier = userInfo?.username || userInfo?.email || 'Unknown user';

                const message = [
                    `🐛 New Bug Report!`,
                    ``,
                    `📋 ${categoryLabel}`,
                    ``,
                    `${request.description.slice(0, 300)}${request.description.length > 300 ? '...' : ''}`,
                    routeInfo,
                    `👤 Reported by: ${userIdentifier}`,
                ].filter(Boolean).join('\n');

                // Use callback button for webhook (works in production)
                // Fall back to URL link for localhost (webhook not available)
                if (isHttps) {
                    const callbackData = `approve_bug:${newReport._id}`;
                    await sendNotificationToOwner(message, {
                        inlineKeyboard: [[
                            { text: '✅ Approve & Create GitHub Issue', callback_data: callbackData }
                        ]]
                    });
                } else {
                    // Localhost fallback - use URL button
                    const approveUrl = `${baseUrl}/api/reports/approve/${newReport._id}?token=${approvalToken}`;
                    const localMessage = `${message}\n\n🔗 Approve: ${approveUrl}`;
                    await sendNotificationToOwner(localMessage);
                }
            } catch (notifyError) {
                // Don't fail the request if notification fails
                console.error('[Telegram] Failed to send bug report notification:', notifyError);
            }
        }

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
            duplicateOf: undefined,
            occurrenceCount: newReport.occurrenceCount,
            firstOccurrence: newReport.firstOccurrence.toISOString(),
            lastOccurrence: newReport.lastOccurrence.toISOString(),
            errorKey: newReport.errorKey,
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
