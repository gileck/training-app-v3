/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for initial feature request and bug report approval
 */

import { featureRequests, reports } from '@/server/database';
import { approveFeatureRequest, approveBugReport } from '@/server/github-sync';
import { STATUSES } from '@/server/project-management/config';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExists,
} from '@/agents/lib/logging';
import { editMessageText, editMessageWithResult } from '../telegram-api';
import { escapeHtml } from '../utils';
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
    // Atomically claim the approval token to prevent double-click race conditions.
    // Only the first concurrent request will succeed; subsequent ones get null.
    const request = await featureRequests.claimApprovalToken(requestId);

    if (!request) {
        // Either not found, no token, or already claimed by another request.
        // Check if already approved to show a friendly message.
        const existingRequest = await featureRequests.findFeatureRequestById(requestId);
        if (existingRequest?.githubIssueUrl) {
            if (callbackQuery.message) {
                await editMessageWithResult(
                    botToken,
                    callbackQuery.message.chat.id,
                    callbackQuery.message.message_id,
                    callbackQuery.message.text || '',
                    true,
                    'Already approved!',
                    existingRequest.githubIssueUrl
                );
            }
            return { success: true };
        }
        console.warn(`[LOG:APPROVAL] Invalid or already-claimed approval token for request: ${requestId}`);
        return { success: false, error: 'Invalid or expired approval token' };
    }

    // Token is now claimed - no other concurrent request can pass this point.
    // Approve the request (updates status + creates GitHub issue)
    const result = await approveFeatureRequest(requestId);

    if (!result.success) {
        // Restore the approval token so the user can retry
        if (request.approvalToken) {
            await featureRequests.updateApprovalToken(requestId, request.approvalToken);
        }
        console.error(`[LOG:APPROVAL] Failed to approve feature request ${requestId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

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
    // Atomically claim the approval token to prevent double-click race conditions.
    // Only the first concurrent request will succeed; subsequent ones get null.
    const report = await reports.claimApprovalToken(reportId);

    if (!report) {
        // Either not found, no token, or already claimed by another request.
        // Check if already approved to show a friendly message.
        const existingReport = await reports.findReportById(reportId);
        if (existingReport?.githubIssueUrl) {
            if (callbackQuery.message) {
                await editMessageWithResult(
                    botToken,
                    callbackQuery.message.chat.id,
                    callbackQuery.message.message_id,
                    callbackQuery.message.text || '',
                    true,
                    'Already approved!',
                    existingReport.githubIssueUrl
                );
            }
            return { success: true };
        }
        console.warn(`[LOG:APPROVAL] Invalid or already-claimed approval token for report: ${reportId}`);
        return { success: false, error: 'Invalid or expired approval token' };
    }

    // Token is now claimed - no other concurrent request can pass this point.
    // Approve the bug report (updates status + creates GitHub issue)
    const result = await approveBugReport(reportId);

    if (!result.success) {
        // Restore the approval token so the user can retry
        if (report.approvalToken) {
            await reports.updateApprovalToken(reportId, report.approvalToken);
        }
        console.error(`[LOG:APPROVAL] Failed to approve bug report ${reportId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

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
            `GitHub issue created for "${description}"\n🔍 Routed to: Bug Investigation`,
            result.githubResult?.issueUrl
        );
    }

    console.log(`Telegram webhook: approved bug report ${reportId}`);
    return { success: true };
}

/**
 * Handle feature request deletion
 * Callback format: "delete_request:requestId"
 * Completely removes the feature request from MongoDB
 */
export async function handleFeatureRequestDeletion(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    requestId: string
): Promise<HandlerResult> {
    const request = await featureRequests.findFeatureRequestById(requestId);

    if (!request) {
        if (callbackQuery.message) {
            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(callbackQuery.message.text || '') + '\n\n⚠️ <b>Already deleted</b>',
                'HTML'
            );
        }
        return { success: true };
    }

    if (request.githubIssueUrl) {
        return { success: false, error: 'Cannot delete: already synced to GitHub' };
    }

    const deleted = await featureRequests.deleteFeatureRequest(requestId);

    if (!deleted) {
        return { success: false, error: 'Failed to delete feature request' };
    }

    if (callbackQuery.message) {
        const newText = escapeHtml(callbackQuery.message.text || '') + `\n\n🗑 <b>Deleted</b>\nFeature request "${request.title}" has been deleted.`;
        await editMessageText(botToken, callbackQuery.message.chat.id, callbackQuery.message.message_id, newText, 'HTML');
    }

    console.log(`Telegram webhook: deleted feature request ${requestId}`);
    return { success: true };
}

/**
 * Handle bug report deletion
 * Callback format: "delete_bug:reportId"
 * Completely removes the bug report from MongoDB
 */
export async function handleBugReportDeletion(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    reportId: string
): Promise<HandlerResult> {
    const report = await reports.findReportById(reportId);

    if (!report) {
        if (callbackQuery.message) {
            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(callbackQuery.message.text || '') + '\n\n⚠️ <b>Already deleted</b>',
                'HTML'
            );
        }
        return { success: true };
    }

    if (report.githubIssueUrl) {
        return { success: false, error: 'Cannot delete: already synced to GitHub' };
    }

    const deleted = await reports.deleteReport(reportId);

    if (!deleted) {
        return { success: false, error: 'Failed to delete bug report' };
    }

    const description = report.description?.slice(0, 50) || 'Bug Report';
    if (callbackQuery.message) {
        const newText = escapeHtml(callbackQuery.message.text || '') + `\n\n🗑 <b>Deleted</b>\nBug report "${description}" has been deleted.`;
        await editMessageText(botToken, callbackQuery.message.chat.id, callbackQuery.message.message_id, newText, 'HTML');
    }

    console.log(`Telegram webhook: deleted bug report ${reportId}`);
    return { success: true };
}

/**
 * Handle feature request approval to Backlog
 * Callback format: "approve_request_bl:requestId"
 * Creates GitHub issue but parks it in Backlog without sending a routing notification
 */
export async function handleFeatureRequestApprovalToBacklog(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    requestId: string
): Promise<HandlerResult> {
    const request = await featureRequests.claimApprovalToken(requestId);

    if (!request) {
        const existingRequest = await featureRequests.findFeatureRequestById(requestId);
        if (existingRequest?.githubIssueUrl) {
            if (callbackQuery.message) {
                await editMessageWithResult(
                    botToken,
                    callbackQuery.message.chat.id,
                    callbackQuery.message.message_id,
                    callbackQuery.message.text || '',
                    true,
                    'Already approved!',
                    existingRequest.githubIssueUrl
                );
            }
            return { success: true };
        }
        console.warn(`[LOG:APPROVAL] Invalid or already-claimed approval token for request: ${requestId}`);
        return { success: false, error: 'Invalid or expired approval token' };
    }

    const result = await approveFeatureRequest(requestId, { skipNotification: true, initialStatusOverride: STATUSES.backlog });

    if (!result.success) {
        if (request.approvalToken) {
            await featureRequests.updateApprovalToken(requestId, request.approvalToken);
        }
        console.error(`[LOG:APPROVAL] Failed to approve feature request to backlog ${requestId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

    const issueNumber = result.githubResult?.issueNumber;
    if (issueNumber && logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Admin Approval', 'telegram');
        logWebhookAction(issueNumber, 'feature_approved_backlog', `Feature request "${request.title}" approved to Backlog`, {
            requestId,
            issueNumber,
            issueUrl: result.githubResult?.issueUrl,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Approval', 'success', 'telegram');
    }

    if (callbackQuery.message) {
        await editMessageWithResult(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            true,
            `GitHub issue created for "${request.title}"\n📋 Routed to: Backlog`,
            result.githubResult?.issueUrl
        );
    }

    console.log(`Telegram webhook: approved feature request ${requestId} to backlog`);
    return { success: true };
}

/**
 * Handle bug report approval to Backlog
 * Callback format: "approve_bug_bl:reportId"
 * Creates GitHub issue but parks it in Backlog instead of Bug Investigation
 */
export async function handleBugReportApprovalToBacklog(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    reportId: string
): Promise<HandlerResult> {
    const report = await reports.claimApprovalToken(reportId);

    if (!report) {
        const existingReport = await reports.findReportById(reportId);
        if (existingReport?.githubIssueUrl) {
            if (callbackQuery.message) {
                await editMessageWithResult(
                    botToken,
                    callbackQuery.message.chat.id,
                    callbackQuery.message.message_id,
                    callbackQuery.message.text || '',
                    true,
                    'Already approved!',
                    existingReport.githubIssueUrl
                );
            }
            return { success: true };
        }
        console.warn(`[LOG:APPROVAL] Invalid or already-claimed approval token for report: ${reportId}`);
        return { success: false, error: 'Invalid or expired approval token' };
    }

    const result = await approveBugReport(reportId, { skipNotification: true, initialStatusOverride: STATUSES.backlog });

    if (!result.success) {
        if (report.approvalToken) {
            await reports.updateApprovalToken(reportId, report.approvalToken);
        }
        console.error(`[LOG:APPROVAL] Failed to approve bug report to backlog ${reportId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

    const issueNumber = result.githubResult?.issueNumber;
    const description = report.description?.slice(0, 50) || 'Bug Report';
    if (issueNumber && logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Admin Approval', 'telegram');
        logWebhookAction(issueNumber, 'bug_approved_backlog', `Bug report "${description}" approved to Backlog`, {
            reportId,
            issueNumber,
            issueUrl: result.githubResult?.issueUrl,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Approval', 'success', 'telegram');
    }

    if (callbackQuery.message) {
        await editMessageWithResult(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            true,
            `GitHub issue created for "${description}"\n📋 Routed to: Backlog`,
            result.githubResult?.issueUrl
        );
    }

    console.log(`Telegram webhook: approved bug report ${reportId} to backlog`);
    return { success: true };
}
