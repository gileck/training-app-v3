/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for initial feature request and bug report approval
 *
 * Thin transport layer: token claiming + call service + edit message.
 * All business logic (DB, GitHub sync, logging, notifications) lives in workflow-service.
 */

import { featureRequests, reports } from '@/server/database';
import { approveWorkflowItem, deleteWorkflowItem } from '@/server/workflow-service';
import { editMessageText, editMessageWithResult } from '../telegram-api';
import { escapeHtml } from '../utils';
import type { TelegramCallbackQuery, HandlerResult } from '../types';

/**
 * Handle initial feature request approval
 * Callback format: "approve_request:requestId"
 */
export async function handleFeatureRequestApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    requestId: string
): Promise<HandlerResult> {
    // Token claiming — Telegram-specific guard against double-click races
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

    // Call service
    const result = await approveWorkflowItem({ id: requestId, type: 'feature' });

    if (!result.success) {
        // Restore the approval token so the user can retry
        if (request.approvalToken) {
            await featureRequests.updateApprovalToken(requestId, request.approvalToken);
        }
        console.error(`[LOG:APPROVAL] Failed to approve feature request ${requestId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

    // Edit message
    if (callbackQuery.message) {
        await editMessageWithResult(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            true,
            `GitHub issue created for "${result.title || request.title}"`,
            result.issueUrl
        );
    }

    console.log(`Telegram webhook: approved feature request ${requestId}`);
    return { success: true };
}

/**
 * Handle bug report approval
 * Callback format: "approve_bug:reportId"
 */
export async function handleBugReportApproval(
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

    const result = await approveWorkflowItem({ id: reportId, type: 'bug' });

    if (!result.success) {
        if (report.approvalToken) {
            await reports.updateApprovalToken(reportId, report.approvalToken);
        }
        console.error(`[LOG:APPROVAL] Failed to approve bug report ${reportId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

    const description = result.title || report.description?.slice(0, 50) || 'Bug Report';
    if (callbackQuery.message) {
        await editMessageWithResult(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            true,
            `GitHub issue created for "${description}"\n🔍 Routed to: Bug Investigation`,
            result.issueUrl
        );
    }

    console.log(`Telegram webhook: approved bug report ${reportId}`);
    return { success: true };
}

/**
 * Handle feature request deletion
 * Callback format: "delete_request:requestId"
 */
export async function handleFeatureRequestDeletion(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    requestId: string
): Promise<HandlerResult> {
    const result = await deleteWorkflowItem({ id: requestId, type: 'feature' });

    if (!result.success) {
        if (result.error === 'Cannot delete: already synced to GitHub') {
            return { success: false, error: result.error };
        }
        // Item may already be deleted
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

    if (callbackQuery.message) {
        const newText = escapeHtml(callbackQuery.message.text || '') + `\n\n🗑 <b>Deleted</b>\nFeature request "${result.title}" has been deleted.`;
        await editMessageText(botToken, callbackQuery.message.chat.id, callbackQuery.message.message_id, newText, 'HTML');
    }

    console.log(`Telegram webhook: deleted feature request ${requestId}`);
    return { success: true };
}

/**
 * Handle bug report deletion
 * Callback format: "delete_bug:reportId"
 */
export async function handleBugReportDeletion(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    reportId: string
): Promise<HandlerResult> {
    const result = await deleteWorkflowItem({ id: reportId, type: 'bug' });

    if (!result.success) {
        if (result.error === 'Cannot delete: already synced to GitHub') {
            return { success: false, error: result.error };
        }
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

    if (callbackQuery.message) {
        const newText = escapeHtml(callbackQuery.message.text || '') + `\n\n🗑 <b>Deleted</b>\nBug report "${result.title}" has been deleted.`;
        await editMessageText(botToken, callbackQuery.message.chat.id, callbackQuery.message.message_id, newText, 'HTML');
    }

    console.log(`Telegram webhook: deleted bug report ${reportId}`);
    return { success: true };
}

/**
 * Handle feature request approval to Backlog
 * Callback format: "approve_request_bl:requestId"
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

    const result = await approveWorkflowItem({ id: requestId, type: 'feature' }, { initialRoute: 'backlog' });

    if (!result.success) {
        if (request.approvalToken) {
            await featureRequests.updateApprovalToken(requestId, request.approvalToken);
        }
        console.error(`[LOG:APPROVAL] Failed to approve feature request to backlog ${requestId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

    if (callbackQuery.message) {
        await editMessageWithResult(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            true,
            `GitHub issue created for "${result.title || request.title}"\n📋 Routed to: Backlog`,
            result.issueUrl
        );
    }

    console.log(`Telegram webhook: approved feature request ${requestId} to backlog`);
    return { success: true };
}

/**
 * Handle bug report approval to Backlog
 * Callback format: "approve_bug_bl:reportId"
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

    const result = await approveWorkflowItem({ id: reportId, type: 'bug' }, { initialRoute: 'backlog' });

    if (!result.success) {
        if (report.approvalToken) {
            await reports.updateApprovalToken(reportId, report.approvalToken);
        }
        console.error(`[LOG:APPROVAL] Failed to approve bug report to backlog ${reportId}: ${result.error}`);
        return { success: false, error: result.error || 'Failed to approve' };
    }

    const description = result.title || report.description?.slice(0, 50) || 'Bug Report';
    if (callbackQuery.message) {
        await editMessageWithResult(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            true,
            `GitHub issue created for "${description}"\n📋 Routed to: Backlog`,
            result.issueUrl
        );
    }

    console.log(`Telegram webhook: approved bug report ${reportId} to backlog`);
    return { success: true };
}
