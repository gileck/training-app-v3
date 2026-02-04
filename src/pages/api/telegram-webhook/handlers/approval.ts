/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for initial feature request and bug report approval
 */

import { featureRequests, reports } from '@/server/database';
import { approveFeatureRequest, approveBugReport } from '@/server/github-sync';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExists,
} from '@/agents/lib/logging';
import { editMessageWithResult } from '../telegram-api';
import type { TelegramCallbackQuery, HandlerResult } from '../types';

/**
 * Handle initial feature request approval
 * Callback format: "approve_request:requestId"
 * (Token is verified from database - not included in callback_data due to 64-byte limit)
 */
export async function handleFeatureRequestApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    requestId: string
): Promise<HandlerResult> {
    // Fetch the feature request
    const request = await featureRequests.findFeatureRequestById(requestId);

    if (!request) {
        console.warn(`[LOG:APPROVAL] Feature request not found: ${requestId}`);
        return { success: false, error: 'Feature request not found' };
    }

    // Verify the token exists (token was stored in database when request was created)
    if (!request.approvalToken) {
        console.warn(`[LOG:APPROVAL] Invalid approval token for request: ${requestId}`);
        return { success: false, error: 'Invalid or expired approval token' };
    }

    // Check if already approved
    if (request.githubIssueUrl) {
        // Already approved - still success, show the existing issue
        if (callbackQuery.message) {
            await editMessageWithResult(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                callbackQuery.message.text || '',
                true,
                'Already approved!',
                request.githubIssueUrl
            );
        }
        return { success: true };
    }

    // Approve the request (updates status + creates GitHub issue)
    const result = await approveFeatureRequest(requestId);

    if (!result.success) {
        console.error(`[LOG:APPROVAL] Failed to approve feature request ${requestId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

    // Clear the approval token (one-time use)
    await featureRequests.updateApprovalToken(requestId, null);

    // Log to agent log file (now that we have the issue number)
    const issueNumber = result.githubResult?.issueNumber;
    if (issueNumber && logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Admin Approval', 'telegram');
        logWebhookAction(issueNumber, 'feature_approved', `Feature request "${request.title}" approved`, {
            requestId,
            issueNumber,
            issueUrl: result.githubResult?.issueUrl,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Approval', 'success', 'telegram');
    }

    // Update the message with success
    if (callbackQuery.message) {
        await editMessageWithResult(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            true,
            `GitHub issue created for "${request.title}"`,
            result.githubResult?.issueUrl
        );
    }

    console.log(`Telegram webhook: approved feature request ${requestId}`);
    return { success: true };
}

/**
 * Handle bug report approval
 * Callback format: "approve_bug:reportId"
 * (Token is verified from database - not included in callback_data due to 64-byte limit)
 */
export async function handleBugReportApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    reportId: string
): Promise<HandlerResult> {
    // Fetch the bug report
    const report = await reports.findReportById(reportId);

    if (!report) {
        console.warn(`[LOG:APPROVAL] Bug report not found: ${reportId}`);
        return { success: false, error: 'Bug report not found' };
    }

    // Verify the token exists (token was stored in database when report was created)
    if (!report.approvalToken) {
        console.warn(`[LOG:APPROVAL] Invalid approval token for report: ${reportId}`);
        return { success: false, error: 'Invalid or expired approval token' };
    }

    // Check if already approved
    if (report.githubIssueUrl) {
        // Already approved - still success, show the existing issue
        if (callbackQuery.message) {
            await editMessageWithResult(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                callbackQuery.message.text || '',
                true,
                'Already approved!',
                report.githubIssueUrl
            );
        }
        return { success: true };
    }

    // Approve the bug report (updates status + creates GitHub issue)
    const result = await approveBugReport(reportId);

    if (!result.success) {
        console.error(`[LOG:APPROVAL] Failed to approve bug report ${reportId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

    // Clear the approval token (one-time use)
    await reports.updateApprovalToken(reportId, null);

    // Log to agent log file (now that we have the issue number)
    const issueNumber = result.githubResult?.issueNumber;
    const description = report.description?.slice(0, 50) || 'Bug Report';
    if (issueNumber && logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Admin Approval', 'telegram');
        logWebhookAction(issueNumber, 'bug_approved', `Bug report "${description}" approved`, {
            reportId,
            issueNumber,
            issueUrl: result.githubResult?.issueUrl,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Approval', 'success', 'telegram');
    }

    // Update the message with success
    if (callbackQuery.message) {
        await editMessageWithResult(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            true,
            `GitHub issue created for "${description}"`,
            result.githubResult?.issueUrl
        );
    }

    console.log(`Telegram webhook: approved bug report ${reportId}`);
    return { success: true };
}
