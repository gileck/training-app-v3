/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Telegram Webhook API Endpoint
 *
 * Handles callback queries from inline keyboard buttons in Telegram notifications.
 * Supports multiple flows:
 *
 * 1. Initial Feature Request Approval:
 *    - Callback: "approve_request:requestId"
 *    - Creates GitHub issue from feature request
 *
 * 2. Design Review Actions (Product/Tech Design):
 *    - Callback: "approve:issueNumber" | "changes:issueNumber" | "reject:issueNumber"
 *    - Updates GitHub Project review status
 *
 * 3. PR Merge Flow (after PR Review approval):
 *    - Callback: "merge:issueNumber:prNumber" - Squash merge PR with saved commit message
 *    - Callback: "reqchanges:issueNumber:prNumber" - Send back to implementation
 *
 * 4. Clarification Flow:
 *    - Callback: "clarified:issueNumber" - Mark clarification as received
 *
 * 5. Routing (after initial sync):
 *    - Callback: "route_feature:requestId:destination" | "route_bug:reportId:destination"
 *
 * 6. Undo Actions (5-minute window to revert accidental clicks):
 *    - Callback: "u_rc:issueNumber:prNumber:timestamp" - Undo implementation PR request changes
 *    - Callback: "u_dc:prNumber:issueNumber:type:timestamp" - Undo design PR request changes
 *    - Callback: "u_dr:issueNumber:action:previousStatus:timestamp" - Undo design review changes/reject
 *
 * 7. Revert Merge:
 *    - Callback: "rv:issueNumber:prNumber:shortSha:prevStatus:phase" - Create revert PR and reset status
 *    - Callback: "merge_rv:issueNumber:revertPrNumber" - Merge the revert PR
 *
 * This is a direct API route because Telegram sends webhook requests directly to this URL.
 * It cannot go through the standard API architecture.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectManagementAdapter } from '@/server/project-management';
import { STATUSES, REVIEW_STATUSES, COMMIT_MESSAGE_MARKER, getIssueUrl } from '@/server/project-management/config';
import { featureRequests, reports } from '@/server/database';
import { approveFeatureRequest, approveBugReport } from '@/server/github-sync';
import { parseCommitMessageComment } from '@/agents/lib/commitMessage';
import { getPrUrl } from '@/server/project-management/config';
import { readDesignDoc } from '@/agents/lib/design-files';
import { formatPhasesToComment, parsePhasesFromMarkdown, hasPhaseComment } from '@/agents/lib/phases';
import {
    initializeImplementationPhases,
    parsePhaseString,
    updateDesignArtifact,
    getDesignDocLink,
    updateImplementationPhaseArtifact,
    parseArtifactComment,
    getTaskBranch,
    generateTaskBranchName,
    clearTaskBranch,
} from '@/agents/lib';
import { sendNotificationToOwner } from '@/server/telegram';
import { appConfig } from '@/app.config';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExternalError,
    logExists,
} from '@/agents/lib/logging';

/**
 * Status transitions when approved - move to next phase
 */
const STATUS_TRANSITIONS: Record<string, string> = {
    [STATUSES.productDesign]: STATUSES.techDesign,
    [STATUSES.techDesign]: STATUSES.implementation,
    // Implementation → PR Review happens automatically when agent creates PR
    // PR Review doesn't auto-advance - PR needs manual merge → Done
};

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Undo timeout in milliseconds (5 minutes)
 */
const UNDO_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Check if undo is still within the time window
 */
function isUndoValid(timestamp: number): boolean {
    return Date.now() - timestamp < UNDO_TIMEOUT_MS;
}

/**
 * Format remaining undo time for display
 */
function formatUndoTimeRemaining(timestamp: number): string {
    const remaining = Math.max(0, UNDO_TIMEOUT_MS - (Date.now() - timestamp));
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface TelegramCallbackQuery {
    id: string;
    from: {
        id: number;
        username?: string;
    };
    message?: {
        message_id: number;
        chat: {
            id: number;
        };
        text?: string;
    };
    data?: string;
}

interface TelegramUpdate {
    update_id: number;
    callback_query?: TelegramCallbackQuery;
}

type ReviewAction = 'approve' | 'changes' | 'reject';

const ACTION_TO_REVIEW_STATUS: Record<ReviewAction, string> = {
    approve: REVIEW_STATUSES.approved,
    changes: REVIEW_STATUSES.requestChanges,
    reject: REVIEW_STATUSES.rejected,
};

const ACTION_LABELS: Record<ReviewAction, string> = {
    approve: 'Approved',
    changes: 'Requested Changes',
    reject: 'Rejected',
};

const ACTION_EMOJIS: Record<ReviewAction, string> = {
    approve: '✅',
    changes: '📝',
    reject: '❌',
};

/**
 * Answer a callback query (acknowledge button click)
 */
async function answerCallbackQuery(
    botToken: string,
    callbackQueryId: string,
    text: string
): Promise<void> {
    await fetch(`${TELEGRAM_API_URL}${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text,
        }),
    });
}

/**
 * Edit message with custom content (for initial approval)
 */
async function editMessageWithResult(
    botToken: string,
    chatId: number,
    messageId: number,
    originalText: string,
    success: boolean,
    resultMessage: string,
    linkUrl?: string
): Promise<void> {
    const emoji = success ? '✅' : '❌';
    const status = success ? 'Approved' : 'Error';

    // Escape originalText for HTML safety
    let newText = `${escapeHtml(originalText)}\n\n${emoji} <b>${status}</b>\n${resultMessage}`;
    if (linkUrl) {
        newText += `\n\n🔗 <a href="${linkUrl}">View GitHub Issue</a>`;
    }

    await fetch(`${TELEGRAM_API_URL}${botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: newText,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: [] },
        }),
    });
}

/**
 * Simple helper to edit message text
 */
async function editMessageText(
    botToken: string,
    chatId: number,
    messageId: number,
    text: string,
    parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<void> {
    await fetch(`${TELEGRAM_API_URL}${botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: parseMode,
            disable_web_page_preview: true,
        }),
    });
}

/**
 * Edit message with an undo button
 * The undo button includes a timestamp to enforce time window
 */
async function editMessageWithUndoButton(
    botToken: string,
    chatId: number,
    messageId: number,
    text: string,
    undoCallbackData: string,
    timestamp: number
): Promise<void> {
    const timeRemaining = formatUndoTimeRemaining(timestamp);
    await fetch(`${TELEGRAM_API_URL}${botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [[
                    { text: `↩️ Undo (${timeRemaining})`, callback_data: undoCallbackData },
                ]],
            },
        }),
    });
}

/**
 * Escape HTML special characters for Telegram HTML mode
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Parse and validate callback data with defensive parsing
 * Handles whitespace, case normalization, and type validation
 */
function parseCallbackData(callbackData: string) {
    const trimmed = callbackData.trim();
    const parts = trimmed.split(':').map(p => p.trim());
    const action = parts[0]?.toLowerCase() || '';

    return {
        action,
        parts,
        /**
         * Safely parse an integer from a callback data part
         * Returns null if the value is invalid, NaN, or missing
         */
        getInt: (index: number): number | null => {
            const val = parseInt(parts[index]?.trim() || '', 10);
            return isNaN(val) || !val ? null : val;
        },
        /**
         * Safely get a string from a callback data part
         * Returns empty string if missing
         */
        getString: (index: number): string => parts[index]?.trim() || '',
    };
}

/**
 * Find project item by issue number
 */
async function findItemByIssueNumber(
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    issueNumber: number
): Promise<{ itemId: string; title: string; status: string | null; reviewStatus: string | null } | null> {
    const items = await adapter.listItems({});

    for (const item of items) {
        if (item.content?.number === issueNumber) {
            return {
                itemId: item.id,
                title: item.content.title,
                status: item.status,
                reviewStatus: item.reviewStatus || null,
            };
        }
    }

    return null;
}

/**
 * Handle initial feature request approval
 * Callback format: "approve_request:requestId"
 * (Token is verified from database - not included in callback_data due to 64-byte limit)
 */
async function handleFeatureRequestApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    requestId: string
): Promise<{ success: boolean; error?: string }> {
    // Fetch the feature request
    const request = await featureRequests.findFeatureRequestById(requestId);

    if (!request) {
        return { success: false, error: 'Feature request not found' };
    }

    // Verify the token exists (token was stored in database when request was created)
    if (!request.approvalToken) {
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
async function handleBugReportApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    reportId: string
): Promise<{ success: boolean; error?: string }> {
    // Fetch the bug report
    const report = await reports.findReportById(reportId);

    if (!report) {
        return { success: false, error: 'Bug report not found' };
    }

    // Verify the token exists (token was stored in database when report was created)
    if (!report.approvalToken) {
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

/**
 * Helper to edit message with routing action
 */
async function editMessageWithRouting(
    botToken: string,
    chatId: number,
    messageId: number,
    originalText: string,
    destination: string
): Promise<void> {
    // Escape originalText for HTML safety
    const newText = `${escapeHtml(originalText)}\n\n✅ <b>Routed to: ${destination}</b>`;

    await fetch(`${TELEGRAM_API_URL}${botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: newText,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: [] },
        }),
    });
}

/**
 * Handle feature routing
 * Callback format: "route_feature:requestId:destination"
 */
async function handleFeatureRouting(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    requestId: string,
    destination: string
): Promise<{ success: boolean; error?: string }> {
    // Get feature request from MongoDB
    const request = await featureRequests.findFeatureRequestById(requestId);
    if (!request || !request.githubProjectItemId) {
        return { success: false, error: 'Feature request not found or not synced' };
    }

    // Map destination to GitHub Project status
    // Note: 'product-dev' is only for features, bugs skip this phase
    const statusMap: Record<string, string> = {
        'product-dev': STATUSES.productDevelopment,
        'product-design': STATUSES.productDesign,
        'tech-design': STATUSES.techDesign,
        'implementation': STATUSES.implementation,
        'backlog': STATUSES.backlog,
    };

    const targetStatus = statusMap[destination];
    if (!targetStatus) {
        return { success: false, error: 'Invalid destination' };
    }

    // Update GitHub Project status
    const adapter = getProjectManagementAdapter();
    await adapter.init();
    await adapter.updateItemStatus(request.githubProjectItemId, targetStatus);

    // Clear review status if moving to a phase that agents process
    if (destination !== 'backlog' && adapter.hasReviewStatusField()) {
        await adapter.clearItemReviewStatus(request.githubProjectItemId);
    }

    // Acknowledge callback
    const destinationLabels: Record<string, string> = {
        'product-dev': 'Product Development',
        'product-design': 'Product Design',
        'tech-design': 'Technical Design',
        'implementation': 'Ready for Development',
        'backlog': 'Backlog',
    };

    // Log to agent log file
    const issueNumber = request.githubIssueNumber;
    if (issueNumber && logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Admin Routing', 'telegram');
        logWebhookAction(issueNumber, 'routed', `Routed to ${destinationLabels[destination]}`, {
            requestId,
            destination,
            targetStatus,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Routing', 'success', 'telegram');
    }

    await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `✅ Moved to ${destinationLabels[destination]}`
    );

    // Edit message to show action taken
    if (callbackQuery.message) {
        await editMessageWithRouting(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            destinationLabels[destination]
        );
    }

    console.log(`Telegram webhook: routed feature ${requestId} to ${destination}`);
    return { success: true };
}

/**
 * Handle bug routing
 * Callback format: "route_bug:reportId:destination"
 */
async function handleBugRouting(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    reportId: string,
    destination: string
): Promise<{ success: boolean; error?: string }> {
    // Get bug report from MongoDB
    const report = await reports.findReportById(reportId);
    if (!report || !report.githubProjectItemId) {
        return { success: false, error: 'Bug report not found or not synced' };
    }

    // Map destination to GitHub Project status
    const statusMap: Record<string, string> = {
        'product-design': STATUSES.productDesign,
        'tech-design': STATUSES.techDesign,
        'implementation': STATUSES.implementation,
        'backlog': STATUSES.backlog,
    };

    const targetStatus = statusMap[destination];
    if (!targetStatus) {
        return { success: false, error: 'Invalid destination' };
    }

    // Update GitHub Project status
    const adapter = getProjectManagementAdapter();
    await adapter.init();
    await adapter.updateItemStatus(report.githubProjectItemId, targetStatus);

    // Clear review status if moving to a phase that agents process
    if (destination !== 'backlog' && adapter.hasReviewStatusField()) {
        await adapter.clearItemReviewStatus(report.githubProjectItemId);
    }

    // Acknowledge callback
    const destinationLabels: Record<string, string> = {
        'product-design': 'Product Design',
        'tech-design': 'Technical Design',
        'implementation': 'Ready for Development',
        'backlog': 'Backlog',
    };

    // Log to agent log file
    const issueNumber = report.githubIssueNumber;
    if (issueNumber && logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Admin Routing', 'telegram');
        logWebhookAction(issueNumber, 'routed', `Routed to ${destinationLabels[destination]}`, {
            reportId,
            destination,
            targetStatus,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Routing', 'success', 'telegram');
    }

    await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `✅ Moved to ${destinationLabels[destination]}`
    );

    // Edit message to show action taken
    if (callbackQuery.message) {
        await editMessageWithRouting(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            destinationLabels[destination]
        );
    }

    console.log(`Telegram webhook: routed bug ${reportId} to ${destination}`);
    return { success: true };
}

/**
 * Handle design review actions (approve/changes/reject)
 * Callback format: "action:issueNumber"
 */
async function handleDesignReviewAction(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    action: ReviewAction,
    issueNumber: number
): Promise<{ success: boolean; error?: string }> {
    const reviewStatus = ACTION_TO_REVIEW_STATUS[action];

    // Initialize the adapter
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Find the project item by issue number
    const item = await findItemByIssueNumber(adapter, issueNumber);

    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    // Update the review status
    await adapter.updateItemReviewStatus(item.itemId, reviewStatus);

    let advancedTo: string | null = null;
    let finalStatus = item.status;
    let finalReviewStatus = reviewStatus;

    // If approved, also auto-advance to next phase
    if (action === 'approve' && item.status) {
        const nextStatus = STATUS_TRANSITIONS[item.status];
        if (nextStatus) {
            await adapter.updateItemStatus(item.itemId, nextStatus);
            // Clear review status for next phase
            await adapter.clearItemReviewStatus(item.itemId);
            advancedTo = nextStatus;
            finalStatus = nextStatus;
            finalReviewStatus = '';
            console.log(`Telegram webhook: auto-advanced to ${nextStatus}`);
        }
    }

    // Log to agent log file
    if (logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Design Review', 'telegram');
        logWebhookAction(issueNumber, `design_${action}`, `Design ${ACTION_LABELS[action].toLowerCase()}`, {
            issueNumber,
            reviewStatus,
            previousStatus: item.status,
            advancedTo,
        });
        if (advancedTo) {
            logWebhookAction(issueNumber, 'status_advanced', `Status advanced to ${advancedTo}`, {
                from: item.status,
                to: advancedTo,
            });
        }
        logWebhookPhaseEnd(issueNumber, 'Design Review', action === 'reject' ? 'failed' : 'success', 'telegram');
    }

    // Build detailed status message for the edited message
    let statusDetails = '';
    const timestamp = Date.now();
    const previousStatus = item.status || '';

    if (action === 'approve') {
        if (advancedTo) {
            statusDetails = `\n\n✅ <b>Success!</b>\n📊 Status: ${advancedTo}\n📋 Review Status: (ready for agent)`;
        } else {
            // Implementation phase - no auto-advance
            statusDetails = `\n\n✅ <b>Success!</b>\n📊 Status: ${finalStatus}\n📋 Review Status: ${finalReviewStatus}\n\n💡 Merge the PR to complete.`;
        }
    } else if (action === 'changes') {
        statusDetails = `\n\n📝 <b>Changes Requested</b>\n📊 Status: ${finalStatus}\n📋 Review Status: ${finalReviewStatus}\n\n💡 Add comments on the issue, then run agents.\n\n<i>Changed your mind? Click Undo within 5 minutes.</i>`;
    } else if (action === 'reject') {
        statusDetails = `\n\n❌ <b>Rejected</b>\n📊 Status: ${finalStatus}\n📋 Review Status: ${finalReviewStatus}\n\n<i>Changed your mind? Click Undo within 5 minutes.</i>`;
    }

    // Acknowledge the button click (toast notification)
    const toastMessage = advancedTo
        ? `✅ Approved → ${advancedTo}`
        : `${ACTION_EMOJIS[action]} ${ACTION_LABELS[action]}`;
    await answerCallbackQuery(botToken, callbackQuery.id, toastMessage);

    // Edit the message to show the action taken with full details
    if (callbackQuery.message) {
        const emoji = ACTION_EMOJIS[action];
        const label = ACTION_LABELS[action];
        const originalText = callbackQuery.message.text || '';
        const newText = `${escapeHtml(originalText)}\n\n${emoji} <b>${label}</b>${statusDetails}`;

        // For changes/reject, show undo button; for approve, no undo needed
        if (action === 'changes' || action === 'reject') {
            // u_dr = undo design review (changes or reject)
            const undoCallback = `u_dr:${issueNumber}:${action}:${previousStatus}:${timestamp}`;
            await editMessageWithUndoButton(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                newText,
                undoCallback,
                timestamp
            );
        } else {
            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                newText,
                'HTML'
            );
        }
    }

    console.log(`Telegram webhook: ${action} issue #${issueNumber} (item ${item.itemId})`);
    return { success: true };
}

/**
 * Handle "Clarification Received" button click
 * Callback format: "clarified:issueNumber"
 */
async function handleClarificationReceived(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number
): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Initialize adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // 2. Find project item by issue number
        const item = await findItemByIssueNumber(adapter, issueNumber);

        if (!item) {
            return { success: false, error: 'Item not found in GitHub Projects' };
        }

        // 3. Verify current status
        if (item.reviewStatus !== REVIEW_STATUSES.waitingForClarification) {
            return {
                success: false,
                error: `Item is not waiting for clarification (current: ${item.reviewStatus || 'none'})`
            };
        }

        // 4. Update review status to "Clarification Received"
        await adapter.updateItemReviewStatus(item.itemId, REVIEW_STATUSES.clarificationReceived);

        // Log to agent log file
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'clarification_received', 'Clarification received from admin', {
                issueNumber,
                reviewStatus: REVIEW_STATUSES.clarificationReceived,
            });
        }

        // 5. Send toast notification
        await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            '✅ Status updated. Agent will continue work.'
        );

        // 6. Edit message to show action taken
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Status Updated</b>',
                '📊 Review Status: Clarification Received',
                '🤖 Agent will continue work on next run',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                'HTML'
            );
        }

        console.log(`Telegram webhook: clarification received for issue #${issueNumber} (item ${item.itemId})`);
        return { success: true };
    } catch (error) {
        console.error('Error handling clarification received:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Create the final PR from feature branch to main for multi-phase workflow
 *
 * Called after the last phase PR is merged to the feature branch.
 * This creates a single PR that contains all the work from all phases.
 *
 * @param adapter - Project management adapter
 * @param issueNumber - GitHub issue number
 * @param totalPhases - Total number of phases that were completed
 * @param issueTitle - Title of the issue
 * @returns The created PR number, or null if creation failed
 */
async function createFinalPRToMain(
    adapter: Awaited<ReturnType<typeof getProjectManagementAdapter>>,
    issueNumber: number,
    totalPhases: number,
    issueTitle: string
): Promise<{ prNumber: number; prUrl: string } | null> {
    console.log(`  [LOG:FEATURE_BRANCH] Creating final PR for issue #${issueNumber}`);

    const taskBranch = generateTaskBranchName(issueNumber);
    const defaultBranch = await adapter.getDefaultBranch();

    // Build comprehensive PR description
    const prTitle = `feat: ${issueTitle}`;
    const prBody = `## Summary

This PR contains all ${totalPhases} phases of the implementation for issue #${issueNumber}.

### Phases Completed
${Array.from({ length: totalPhases }, (_, i) => `- Phase ${i + 1}/${totalPhases}`).join('\n')}

Closes #${issueNumber}

---

**Feature Branch Workflow:**
This is the final PR from the feature branch (\`${taskBranch}\`) to \`${defaultBranch}\`.
All individual phase PRs have been reviewed and merged to the feature branch.

*Generated by Agent Workflow*`;

    try {
        const pr = await adapter.createPullRequest(
            taskBranch,
            defaultBranch,
            prTitle,
            prBody,
            [] // No reviewers - admin will merge via Telegram
        );

        console.log(`  [LOG:FEATURE_BRANCH] Final PR created: #${pr.number}`);
        console.log(`  [LOG:FEATURE_BRANCH] Final PR: ${taskBranch} → ${defaultBranch}`);

        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'final_pr_created', `Final PR #${pr.number} created: ${taskBranch} → ${defaultBranch}`, {
                prNumber: pr.number,
                taskBranch,
                defaultBranch,
                totalPhases,
            });
        }

        return { prNumber: pr.number, prUrl: pr.url };
    } catch (error) {
        console.error(`  [LOG:ERROR] [FEATURE_BRANCH] Failed to create final PR: ${error instanceof Error ? error.message : String(error)}`);

        if (logExists(issueNumber)) {
            logExternalError(issueNumber, 'webhook', error instanceof Error ? error : new Error(String(error)));
        }

        return null;
    }
}

/**
 * Handle merge final PR callback from Telegram (feature branch workflow)
 * Callback format: "merge_final:issueNumber:prNumber"
 *
 * This is called when admin merges the final PR from feature branch to main.
 * Actions:
 * 1. Merge the final PR
 * 2. Update status: Final Review → Done
 * 3. Update MongoDB (feature request or bug report)
 * 4. Delete feature branch and all phase branches
 * 5. Clear task branch from artifact
 * 6. Update Telegram message
 */
async function handleMergeFinalPRCallback(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number
): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`  [LOG:FINAL_REVIEW] Admin merging final PR #${prNumber} for issue #${issueNumber}`);

        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Log phase start
        if (logExists(issueNumber)) {
            logWebhookPhaseStart(issueNumber, 'Final Review Merge', 'telegram');
        }

        // 1. Get PR info to build commit message
        const prInfo = await adapter.getPRInfo(prNumber);
        if (!prInfo) {
            return { success: false, error: 'Could not fetch PR info' };
        }

        // Build commit message for squash merge
        const commitTitle = prInfo.title;
        const commitBody = `Closes #${issueNumber}\n\nFeature branch workflow - final merge to main.`;

        // 2. Merge the final PR
        let mergeCommitSha: string | null = null;
        try {
            mergeCommitSha = await adapter.mergePullRequest(prNumber, commitTitle, commitBody);
            console.log(`  [LOG:FINAL_REVIEW] Final PR #${prNumber} merged, commit: ${mergeCommitSha}`);

            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'final_pr_merged', `Final PR #${prNumber} merged to main`, {
                    prNumber,
                    commitTitle,
                    mergeCommitSha,
                });
            }
        } catch (mergeError) {
            const errorMsg = mergeError instanceof Error ? mergeError.message : String(mergeError);
            // Check if already merged
            if (errorMsg.includes('already been merged') || errorMsg.includes('not open')) {
                console.log(`  [LOG:FINAL_REVIEW] Final PR #${prNumber} already merged, continuing`);
                mergeCommitSha = await adapter.getMergeCommitSha(prNumber);
            } else {
                throw mergeError;
            }
        }

        // 3. Find the project item
        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (!item) {
            console.warn(`  [LOG:WARNING] Project item not found for issue #${issueNumber}`);
        }

        // 4. Get artifact to find task branch
        const issueComments = await adapter.getIssueComments(issueNumber);
        const artifact = parseArtifactComment(issueComments);
        const taskBranch = getTaskBranch(artifact);

        // 5. Update status to Done
        if (item) {
            await adapter.updateItemStatus(item.itemId, STATUSES.done);
            console.log(`  [LOG:FINAL_REVIEW] Status transition: Final Review → Done`);

            // Clear review status
            if (adapter.hasReviewStatusField() && item.reviewStatus) {
                await adapter.clearItemReviewStatus(item.itemId);
            }

            // Clear implementation phase field
            await adapter.clearImplementationPhase(item.itemId);

            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'status_done', 'Final PR merged, issue marked as Done', {
                    status: STATUSES.done,
                    prNumber,
                });
            }
        }

        // 6. Update MongoDB
        const featureRequest = await featureRequests.findByGitHubIssueNumber(issueNumber);
        if (featureRequest) {
            await featureRequests.updateFeatureRequestStatus(featureRequest._id, 'done');
            console.log('Telegram webhook: feature request marked as done in database');
            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'mongodb_updated', 'Feature request marked as done', {
                    featureRequestId: featureRequest._id.toString(),
                });
            }
        } else {
            const bugReport = await reports.findByGitHubIssueNumber(issueNumber);
            if (bugReport) {
                await reports.updateReport(bugReport._id.toString(), { status: 'resolved' });
                console.log('Telegram webhook: bug report marked as resolved in database');
            }
        }

        // 7. Delete branches - feature branch and all phase branches
        console.log(`  [LOG:FEATURE_BRANCH] Cleaning up branches for task-${issueNumber}`);

        // Delete feature branch
        if (taskBranch) {
            try {
                await adapter.deleteBranch(taskBranch);
                console.log(`  [LOG:FEATURE_BRANCH] Deleted branch: ${taskBranch}`);
                if (logExists(issueNumber)) {
                    logWebhookAction(issueNumber, 'branch_deleted', `Deleted feature branch: ${taskBranch}`, {
                        branch: taskBranch,
                    });
                }
            } catch {
                console.log(`  [LOG:FEATURE_BRANCH] Feature branch ${taskBranch} already deleted`);
            }
        }

        // Delete phase branches (try common patterns)
        const phasesToCheck = 10; // Check up to 10 phases
        for (let i = 1; i <= phasesToCheck; i++) {
            const phaseBranch = `feature/task-${issueNumber}-phase-${i}`;
            try {
                await adapter.deleteBranch(phaseBranch);
                console.log(`  [LOG:FEATURE_BRANCH] Deleted branch: ${phaseBranch}`);
            } catch {
                // Branch doesn't exist - that's fine
            }
        }

        // 8. Clear task branch from artifact
        try {
            await clearTaskBranch(adapter, issueNumber);
            console.log(`  [LOG:FEATURE_BRANCH] Cleared task branch from artifact`);
        } catch (artifactError) {
            console.warn('Failed to clear task branch from artifact:', artifactError);
        }

        // 9. Post completion comment
        const completionComment = `🎉 **Feature Complete!**\n\nFinal PR #${prNumber} has been merged to main.\nAll phases have been successfully integrated.`;
        await adapter.addIssueComment(issueNumber, completionComment);

        // Log phase end
        if (logExists(issueNumber)) {
            logWebhookPhaseEnd(issueNumber, 'Final Review Merge', 'success', 'telegram');
        }

        // 10. Update Telegram message
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Final PR Merged Successfully!</b>',
                `PR #${prNumber} merged to main.`,
                '🎉 Feature is now complete!',
                '📊 Status: Done',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                'HTML'
            );
        }

        console.log(`  [LOG:FINAL_REVIEW] Completed final merge for issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error handling final PR merge:', error);

        if (logExists(issueNumber)) {
            logExternalError(issueNumber, 'telegram', error instanceof Error ? error : new Error(String(error)));
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle merge callback from Telegram - SINGLE SOURCE OF TRUTH for PR merge handling
 * Callback format: "merge:issueNumber:prNumber"
 *
 * This function handles ALL post-merge operations:
 * 1. Merge the PR (or handle if already merged)
 * 2. Get phase info for multi-phase features
 * 3. Update artifact comment
 * 4. Post status comment on issue
 * 5. Update project status (next phase or Done)
 * 6. Clear review status
 * 7. Update MongoDB (for final/single phase → done)
 * 8. Delete the feature branch
 * 9. Update Telegram message with confirmation
 */
async function handleMergeCallback(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number
): Promise<{ success: boolean; error?: string }> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // 1. Find the commit message from PR comment
        const commitComment = await adapter.findPRCommentByMarker(prNumber, COMMIT_MESSAGE_MARKER);
        if (!commitComment) {
            return { success: false, error: 'Commit message not found on PR. Please run PR Review again.' };
        }

        const commitMsg = parseCommitMessageComment(commitComment.body);
        if (!commitMsg) {
            return { success: false, error: 'Could not parse commit message. Please run PR Review again.' };
        }

        // Log phase start
        if (logExists(issueNumber)) {
            logWebhookPhaseStart(issueNumber, 'PR Merge', 'telegram');
        }

        // 2. Try to merge the PR (skip if already merged)
        let alreadyMerged = false;
        let mergeCommitSha: string | null = null;
        try {
            mergeCommitSha = await adapter.mergePullRequest(prNumber, commitMsg.title, commitMsg.body);
            console.log(`Telegram webhook: merged PR #${prNumber}, commit: ${mergeCommitSha}`);
            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'pr_merged', `PR #${prNumber} squash-merged`, {
                    prNumber,
                    commitTitle: commitMsg.title,
                    mergeCommitSha,
                });
            }
        } catch (mergeError) {
            const errorMsg = mergeError instanceof Error ? mergeError.message : String(mergeError);
            // Check if PR was already merged
            if (errorMsg.includes('already been merged') ||
                errorMsg.includes('Pull Request is not mergeable') ||
                errorMsg.includes('not open')) {
                console.log(`Telegram webhook: PR #${prNumber} already merged, continuing with status updates`);
                alreadyMerged = true;
                // Try to get the merge commit SHA from the already-merged PR
                mergeCommitSha = await adapter.getMergeCommitSha(prNumber);
                if (logExists(issueNumber)) {
                    logWebhookAction(issueNumber, 'pr_already_merged', `PR #${prNumber} was already merged`, {
                        prNumber,
                        mergeCommitSha,
                    });
                }
            } else {
                if (logExists(issueNumber)) {
                    logExternalError(issueNumber, 'telegram', mergeError instanceof Error ? mergeError : new Error(errorMsg));
                }
                throw mergeError;
            }
        }

        // 3. Find the project item
        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (!item) {
            console.warn(`Telegram webhook: project item not found for issue #${issueNumber}`);
            console.warn(`  DEBUG: This prevents artifact update to 'merged' status`);
            // Still return success if PR was merged - issue just wasn't in project
            if (alreadyMerged || !commitComment) {
                return { success: true };
            }
        } else {
            console.log(`Telegram webhook: found project item for issue #${issueNumber} (itemId: ${item.itemId})`);
        }

        // 4. Check for multi-phase implementation
        const phase = item ? await adapter.getImplementationPhase(item.itemId) : null;
        console.log(`Telegram webhook: Implementation Phase field value: ${phase || '(not set)'}`);
        const parsedPhase = parsePhaseString(phase);
        console.log(`Telegram webhook: Parsed phase: ${parsedPhase ? `${parsedPhase.current}/${parsedPhase.total}` : '(null)'}`);
        console.log(`Telegram webhook: Artifact update condition: item=${!!item}, parsedPhase=${!!parsedPhase}`);

        // Get phase name from artifact comment if available
        const issueComments = await adapter.getIssueComments(issueNumber);
        const artifact = parseArtifactComment(issueComments);
        const currentPhaseArtifact = artifact?.implementation?.phases?.find(
            p => parsedPhase && p.phase === parsedPhase.current
        );
        const phaseName = currentPhaseArtifact?.name || (parsedPhase ? `Phase ${parsedPhase.current}` : '');

        let statusMessage = '';
        let isMultiPhaseMiddle = false;

        if (parsedPhase && item) {
            const taskBranch = getTaskBranch(artifact);
            const isFeatureBranchWorkflow = !!taskBranch;
            const workflowType = isFeatureBranchWorkflow ? 'feature branch' : 'direct-to-main';
            console.log(`Telegram webhook: Multi-phase feature: Phase ${parsedPhase.current}/${parsedPhase.total} (${workflowType})`);
            if (isFeatureBranchWorkflow) {
                console.log(`  [LOG:FEATURE_BRANCH] Phase ${parsedPhase.current}/${parsedPhase.total} PR merged to feature branch`);
            }

            // Update artifact comment to mark phase as merged
            try {
                console.log(`Telegram webhook: updating artifact - phase ${parsedPhase.current}/${parsedPhase.total} to 'merged' for PR #${prNumber}`);
                await updateImplementationPhaseArtifact(
                    adapter,
                    issueNumber,
                    parsedPhase.current,
                    parsedPhase.total,
                    phaseName,
                    'merged',
                    prNumber
                );
                console.log('Telegram webhook: ✅ artifact comment updated - phase marked as merged');
            } catch (artifactError) {
                console.error('Telegram webhook: ❌ failed to update artifact comment');
                console.error('  Error:', artifactError instanceof Error ? artifactError.message : String(artifactError));
                if (artifactError instanceof Error && artifactError.stack) {
                    console.error('  Stack:', artifactError.stack);
                }
            }

            if (parsedPhase.current < parsedPhase.total) {
                // Mid-phase: increment and return to Implementation
                isMultiPhaseMiddle = true;
                const nextPhase = parsedPhase.current + 1;

                // Post status comment on issue
                const phaseCompleteComment = `✅ **Phase ${parsedPhase.current}/${parsedPhase.total}** complete - Merged PR #${prNumber}\n\n🔄 Starting Phase ${nextPhase}/${parsedPhase.total}...`;
                await adapter.addIssueComment(issueNumber, phaseCompleteComment);
                console.log(`Telegram webhook: posted phase completion comment`);

                // Update phase counter
                await adapter.setImplementationPhase(item.itemId, `${nextPhase}/${parsedPhase.total}`);
                console.log(`Telegram webhook: updated Implementation Phase to: ${nextPhase}/${parsedPhase.total}`);

                // Return to Implementation status
                await adapter.updateItemStatus(item.itemId, STATUSES.implementation);
                console.log(`Telegram webhook: status updated to: ${STATUSES.implementation}`);

                // Clear review status for next phase
                if (adapter.hasReviewStatusField() && item.reviewStatus) {
                    await adapter.clearItemReviewStatus(item.itemId);
                    console.log('Telegram webhook: cleared review status');
                }

                // Log multi-phase progress
                if (logExists(issueNumber)) {
                    logWebhookAction(issueNumber, 'phase_complete', `Phase ${parsedPhase.current}/${parsedPhase.total} complete`, {
                        currentPhase: parsedPhase.current,
                        totalPhases: parsedPhase.total,
                        nextPhase,
                        prNumber,
                    });
                    logWebhookAction(issueNumber, 'status_update', `Status returned to Implementation for phase ${nextPhase}`, {
                        status: STATUSES.implementation,
                        phase: `${nextPhase}/${parsedPhase.total}`,
                    });
                }

                statusMessage = `📋 Phase ${parsedPhase.current}/${parsedPhase.total} complete\n🔄 Starting Phase ${nextPhase}/${parsedPhase.total}`;
            } else {
                // Final phase complete - check if using feature branch workflow
                console.log(`  [LOG:FEATURE_BRANCH] All ${parsedPhase.total} phases complete!`);

                // taskBranch already defined above for this block

                if (taskBranch) {
                    // Feature branch workflow: Create Final PR to main
                    console.log(`  [LOG:FEATURE_BRANCH] Using feature branch workflow - creating final PR`);

                    // Get issue details for PR title
                    const issueDetails = await adapter.getIssueDetails(issueNumber);
                    const issueTitle = issueDetails?.title || `Issue #${issueNumber}`;

                    // Create the final PR
                    const finalPR = await createFinalPRToMain(
                        adapter,
                        issueNumber,
                        parsedPhase.total,
                        issueTitle
                    );

                    if (finalPR) {
                        // Post comment about final PR
                        const finalPRComment = `✅ **Phase ${parsedPhase.current}/${parsedPhase.total}** complete - Merged PR #${prNumber}\n\n🚀 **All phases merged to feature branch!**\n📋 Final PR created: #${finalPR.prNumber}\n\nAwaiting admin verification via Vercel preview before merge to main.`;
                        await adapter.addIssueComment(issueNumber, finalPRComment);

                        // Set status to Final Review
                        await adapter.updateItemStatus(item.itemId, STATUSES.finalReview);
                        console.log(`  [LOG:FINAL_REVIEW] Status transition: PR Review → Final Review`);

                        // Clear review status for final review
                        if (adapter.hasReviewStatusField() && item.reviewStatus) {
                            await adapter.clearItemReviewStatus(item.itemId);
                            console.log('Telegram webhook: cleared review status for final review');
                        }

                        // Log final review transition
                        if (logExists(issueNumber)) {
                            logWebhookAction(issueNumber, 'final_review', `All phases complete, final PR #${finalPR.prNumber} created`, {
                                totalPhases: parsedPhase.total,
                                finalPrNumber: finalPR.prNumber,
                                taskBranch,
                            });
                        }

                        // Mark as needing final review (not done yet)
                        isMultiPhaseMiddle = true; // Reuse this flag to prevent marking as Done

                        // Send notification with Final PR merge button
                        if (appConfig.ownerTelegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
                            const finalReviewMessage = [
                                '🚀 <b>All Phases Complete - Final Review</b>',
                                '',
                                `📋 Issue: <b>${escapeHtml(issueTitle)}</b>`,
                                `🔗 Issue #${issueNumber}`,
                                '',
                                `✅ All ${parsedPhase.total} phases have been merged to the feature branch.`,
                                `📋 Final PR: #${finalPR.prNumber}`,
                                '',
                                '🔍 <b>Please verify the complete feature via Vercel preview before merging.</b>',
                            ].join('\n');

                            // Callback format: merge_final:issueNumber:prNumber
                            const mergeFinalCallback = `merge_final:${issueNumber}:${finalPR.prNumber}`;

                            await sendNotificationToOwner(finalReviewMessage, {
                                parseMode: 'HTML',
                                inlineKeyboard: [
                                    [
                                        { text: '✅ Merge Final PR', callback_data: mergeFinalCallback },
                                        { text: '🔗 View PR', url: finalPR.prUrl },
                                    ],
                                ],
                            });
                            console.log('Telegram webhook: sent final review notification');
                        }

                        statusMessage = `🚀 All ${parsedPhase.total} phases complete!\n📋 Final PR #${finalPR.prNumber} created\n📊 Status: Final Review`;
                    } else {
                        // Failed to create final PR - fall back to Done status
                        console.error('  [LOG:ERROR] [FEATURE_BRANCH] Failed to create final PR, falling back to Done');

                        const fallbackComment = `✅ **Phase ${parsedPhase.current}/${parsedPhase.total}** complete - Merged PR #${prNumber}\n\n⚠️ Failed to create final PR. Please manually merge the feature branch (\`${taskBranch}\`) to main.`;
                        await adapter.addIssueComment(issueNumber, fallbackComment);

                        // Clear phase field
                        await adapter.clearImplementationPhase(item.itemId);

                        statusMessage = `🎉 All ${parsedPhase.total} phases complete!\n⚠️ Final PR creation failed\n📊 Status: Done`;
                    }
                } else {
                    // Old workflow (no feature branch) - mark as Done directly
                    console.log(`Telegram webhook: All ${parsedPhase.total} phases complete (old workflow)!`);

                    // Post final completion comment
                    const allPhasesCompleteComment = `✅ **Phase ${parsedPhase.current}/${parsedPhase.total}** complete - Merged PR #${prNumber}\n\n🎉 **All ${parsedPhase.total} phases complete!** Issue is now Done.`;
                    await adapter.addIssueComment(issueNumber, allPhasesCompleteComment);

                    // Clear phase field
                    await adapter.clearImplementationPhase(item.itemId);
                    console.log('Telegram webhook: cleared Implementation Phase field');

                    // Log final phase completion
                    if (logExists(issueNumber)) {
                        logWebhookAction(issueNumber, 'all_phases_complete', `All ${parsedPhase.total} phases complete`, {
                            totalPhases: parsedPhase.total,
                            prNumber,
                        });
                    }

                    statusMessage = `🎉 All ${parsedPhase.total} phases complete!\n📊 Status: Done`;
                }
            }
        } else if (item) {
            // Single-phase feature
            try {
                console.log(`Telegram webhook: updating artifact - single-phase to 'merged' for PR #${prNumber}`);
                // Use Phase 1/1 format for consistency
                await updateImplementationPhaseArtifact(
                    adapter,
                    issueNumber,
                    1,
                    1,
                    '', // No name for single-phase
                    'merged',
                    prNumber
                );
                console.log('Telegram webhook: ✅ artifact comment updated - implementation marked as merged');
            } catch (artifactError) {
                console.error('Telegram webhook: ❌ failed to update artifact comment (single-phase)');
                console.error('  Error:', artifactError instanceof Error ? artifactError.message : String(artifactError));
            }

            // Post completion comment
            const completionComment = `✅ Merged PR #${prNumber} - Issue complete!`;
            await adapter.addIssueComment(issueNumber, completionComment);

            statusMessage = '📊 Status: Done';
        } else {
            // Neither condition met - item not found
            console.warn(`Telegram webhook: ⚠️ SKIPPING artifact update - item not found in project`);
            console.warn(`  DEBUG: item=${!!item}, parsedPhase=${!!parsedPhase}`);
            console.warn(`  DEBUG: This means the artifact will NOT be updated to 'merged' status`);
        }

        // 5. For final/single phase: Update status to Done, update MongoDB
        if (!isMultiPhaseMiddle && item) {
            // Update GitHub Project status to Done
            await adapter.updateItemStatus(item.itemId, STATUSES.done);
            console.log('Telegram webhook: status updated to Done');

            // Clear review status
            if (adapter.hasReviewStatusField() && item.reviewStatus) {
                await adapter.clearItemReviewStatus(item.itemId);
                console.log('Telegram webhook: cleared review status');
            }

            // Log status update to Done
            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'status_done', 'Issue marked as Done', {
                    status: STATUSES.done,
                    prNumber,
                });
            }

            // Update MongoDB
            const featureRequest = await featureRequests.findByGitHubIssueNumber(issueNumber);
            if (featureRequest) {
                await featureRequests.updateFeatureRequestStatus(featureRequest._id, 'done');
                console.log('Telegram webhook: feature request marked as done in database');
                if (logExists(issueNumber)) {
                    logWebhookAction(issueNumber, 'mongodb_updated', 'Feature request marked as done in database', {
                        featureRequestId: featureRequest._id.toString(),
                    });
                }
            } else {
                const bugReport = await reports.findByGitHubIssueNumber(issueNumber);
                if (bugReport) {
                    await reports.updateReport(bugReport._id.toString(), { status: 'resolved' });
                    console.log('Telegram webhook: bug report marked as resolved in database');
                    if (logExists(issueNumber)) {
                        logWebhookAction(issueNumber, 'mongodb_updated', 'Bug report marked as resolved in database', {
                            bugReportId: bugReport._id.toString(),
                        });
                    }
                }
            }
        }

        // 6. Delete the feature branch
        try {
            const prDetails = await adapter.getPRDetails(prNumber);
            if (prDetails?.headBranch) {
                await adapter.deleteBranch(prDetails.headBranch);
                console.log(`Telegram webhook: deleted branch ${prDetails.headBranch}`);
                if (logExists(issueNumber)) {
                    logWebhookAction(issueNumber, 'branch_deleted', `Branch ${prDetails.headBranch} deleted`, {
                        branch: prDetails.headBranch,
                    });
                }
            }
        } catch {
            // Branch may already be deleted - that's fine
            console.log('Telegram webhook: branch already deleted or not found');
        }

        // Log phase end
        if (logExists(issueNumber)) {
            logWebhookPhaseEnd(issueNumber, 'PR Merge', 'success', 'telegram');
        }

        // 7. Update the Telegram message with confirmation
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Merged Successfully!</b>',
                `PR #${prNumber} has been squash-merged.`,
                statusMessage,
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                'HTML'
            );
        }

        // 8. Send notification for multi-phase mid-phase completion (optional)
        if (isMultiPhaseMiddle && parsedPhase && appConfig.ownerTelegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const nextPhase = parsedPhase.current + 1;
            const message = `<b>Agent (Multi-PR):</b> ✅ Phase ${parsedPhase.current}/${parsedPhase.total} merged

🔗 Issue #${issueNumber}
🔀 PR #${prNumber}

Starting Phase ${nextPhase}/${parsedPhase.total}...
Run <code>yarn agent:implement</code> to continue.`;

            // Use different chat ID for agent notifications if configured
            await sendNotificationToOwner(message, {
                parseMode: 'HTML',
            });
            console.log('Telegram webhook: sent multi-phase notification');
        }

        // 9. Send merge success notification with Revert button
        if (mergeCommitSha && appConfig.ownerTelegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            // Get issue title for the notification
            const issueDetails = await adapter.getIssueDetails(issueNumber);
            const issueTitle = issueDetails?.title || `Issue #${issueNumber}`;

            // Get PR info for the notification
            const prInfo = await adapter.getPRInfo(prNumber);
            const prTitle = prInfo?.title || `PR #${prNumber}`;

            // Build progress message
            let progressMessage = '';
            if (isMultiPhaseMiddle && parsedPhase) {
                const nextPhase = parsedPhase.current + 1;
                progressMessage = `📊 Progress: Phase ${parsedPhase.current} of ${parsedPhase.total} complete\n⏭️ Next: Phase ${nextPhase}`;
            } else if (parsedPhase && parsedPhase.current === parsedPhase.total) {
                progressMessage = `🎉 All ${parsedPhase.total} phases complete! Feature ready.`;
            } else {
                progressMessage = `🎉 Implementation complete! Issue is now Done.`;
            }

            // Encode previous status for revert callback
            // Status abbreviations to fit within 64-byte callback limit
            const prevStatus = isMultiPhaseMiddle ? 'prrev' : 'impl';
            const phaseStr = parsedPhase ? `${parsedPhase.current}/${parsedPhase.total}` : '';
            const shortSha = mergeCommitSha.slice(0, 7);

            // Callback format: rv:issueNum:prNum:shortSha:prevStatus:phase
            const revertCallback = `rv:${issueNumber}:${prNumber}:${shortSha}:${prevStatus}:${phaseStr}`;

            const successMessage = [
                '✅ <b>PR Merged Successfully</b>',
                '',
                `📝 PR: #${prNumber} - ${escapeHtml(prTitle)}`,
                `🔗 Issue: #${issueNumber} - ${escapeHtml(issueTitle)}`,
                '',
                progressMessage,
            ].join('\n');

            await sendNotificationToOwner(successMessage, {
                parseMode: 'HTML',
                inlineKeyboard: [
                    [
                        { text: '📄 View PR', url: getPrUrl(prNumber) },
                        { text: '📋 View Issue', url: getIssueUrl(issueNumber) },
                    ],
                    [
                        { text: '↩️ Revert', callback_data: revertCallback },
                    ],
                ],
            });
            console.log('Telegram webhook: sent merge success notification with revert button');
        }

        console.log(`Telegram webhook: completed merge handling for PR #${prNumber}, issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error handling merge:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle revert merge callback
 * Callback format: "rv:issueNumber:prNumber:shortSha:prevStatus:phase"
 *
 * Actions:
 * 1. Create a revert PR using GitHub API
 * 2. Update GitHub Project status back to previous status
 * 3. Restore phase info for multi-phase features
 * 4. Update MongoDB status if needed
 * 5. Send confirmation message with link to revert PR
 */
async function handleRevertMerge(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number,
    shortSha: string,
    prevStatus: string,
    phase: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Get the full merge commit SHA from the PR
        const fullSha = await adapter.getMergeCommitSha(prNumber);
        if (!fullSha) {
            return { success: false, error: 'Could not find merge commit SHA' };
        }

        // Verify the short SHA matches
        if (!fullSha.startsWith(shortSha)) {
            return { success: false, error: 'Merge commit SHA mismatch' };
        }

        console.log(`Telegram webhook: creating revert PR for merge commit ${fullSha}`);

        // Create the revert PR
        const revertResult = await adapter.createRevertPR(fullSha, prNumber, issueNumber);
        if (!revertResult) {
            return { success: false, error: 'Failed to create revert PR. There may be conflicts - please revert manually.' };
        }

        console.log(`Telegram webhook: created revert PR #${revertResult.prNumber}`);

        // Find the project item
        const items = await adapter.listItems();
        const item = items.find(i =>
            i.content?.type === 'Issue' &&
            i.content.number === issueNumber
        );

        if (item) {
            // Restore to Implementation status (code needs to be fixed)
            await adapter.updateItemStatus(item.id, STATUSES.implementation);
            console.log(`Telegram webhook: restored status to ${STATUSES.implementation}`);

            // Set review status to Request Changes (indicating there's feedback to address)
            if (adapter.hasReviewStatusField()) {
                await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.requestChanges);
                console.log(`Telegram webhook: set review status to ${REVIEW_STATUSES.requestChanges}`);
            }

            // Restore phase if applicable
            if (phase && adapter.hasImplementationPhaseField()) {
                await adapter.setImplementationPhase(item.id, phase);
                console.log(`Telegram webhook: restored phase to ${phase}`);
            }
        }

        // Update MongoDB status back to in_progress/investigating
        const featureRequest = await featureRequests.findByGitHubIssueNumber(issueNumber);
        if (featureRequest) {
            await featureRequests.updateFeatureRequestStatus(featureRequest._id, 'in_progress');
            console.log('Telegram webhook: feature request status reverted to in_progress');
        } else {
            const bugReport = await reports.findByGitHubIssueNumber(issueNumber);
            if (bugReport) {
                await reports.updateReport(bugReport._id.toString(), { status: 'investigating' });
                console.log('Telegram webhook: bug report status reverted to investigating');
            }
        }

        // Update the original message to show revert was initiated
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const revertNote = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '↩️ <b>Revert Initiated</b>',
                `Revert PR #${revertResult.prNumber} created`,
                '',
                `<a href="${revertResult.url}">View Revert PR</a>`,
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + revertNote,
                'HTML'
            );
        }

        // Send confirmation notification
        const issueDetails = await adapter.getIssueDetails(issueNumber);
        const issueTitle = issueDetails?.title || `Issue #${issueNumber}`;

        const confirmMessage = [
            '↩️ <b>Merge Reverted</b>',
            '',
            `📋 Issue: #${issueNumber} - ${escapeHtml(issueTitle)}`,
            `🔀 Original PR: #${prNumber}`,
            `🔄 Revert PR: #${revertResult.prNumber}`,
            '',
            phase ? `📊 Status: Implementation (Phase ${phase})` : '📊 Status: Implementation',
            '📝 Review Status: Request Changes',
            '',
            '<b>Next steps:</b>',
            '1️⃣ Click "Merge Revert PR" below to undo the changes',
            `2️⃣ Go to Issue #${issueNumber} and add a comment explaining what went wrong`,
            '3️⃣ Run <code>yarn agent:implement</code> - the agent will read your feedback and create a new PR',
        ].join('\n');

        // Callback format: merge_rv:issueNumber:revertPrNumber
        const mergeRevertCallback = `merge_rv:${issueNumber}:${revertResult.prNumber}`;

        await sendNotificationToOwner(confirmMessage, {
            parseMode: 'HTML',
            inlineKeyboard: [
                [
                    { text: '✅ Merge Revert PR', callback_data: mergeRevertCallback },
                ],
                [
                    { text: '📄 View Revert PR', url: revertResult.url },
                    { text: '📋 View Issue', url: getIssueUrl(issueNumber) },
                ],
            ],
        });

        console.log(`Telegram webhook: completed revert handling for PR #${prNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error handling revert:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle merge revert PR callback
 * Callback format: "merge_rv:issueNumber:revertPrNumber"
 *
 * Actions:
 * 1. Merge the revert PR (squash)
 * 2. Delete the revert branch
 * 3. Update the Telegram message
 * 4. Does NOT change status (stays as Implementation with Request Changes)
 */
async function handleMergeRevertPR(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    revertPrNumber: number
): Promise<{ success: boolean; error?: string }> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Get revert PR info for commit message
        const prInfo = await adapter.getPRInfo(revertPrNumber);
        if (!prInfo) {
            return { success: false, error: 'Revert PR not found' };
        }

        // Check if PR is still open
        const prDetails = await adapter.getPRDetails(revertPrNumber);
        if (!prDetails) {
            return { success: false, error: 'Could not get revert PR details' };
        }
        if (prDetails.merged) {
            return { success: false, error: 'Revert PR already merged' };
        }
        if (prDetails.state === 'closed') {
            return { success: false, error: 'Revert PR is closed' };
        }

        // Merge the revert PR
        const commitTitle = prInfo.title;
        const commitBody = `Part of #${issueNumber}`;

        await adapter.mergePullRequest(revertPrNumber, commitTitle, commitBody);
        console.log(`Telegram webhook: merged revert PR #${revertPrNumber}`);

        // Delete the revert branch
        try {
            await adapter.deleteBranch(prDetails.headBranch);
            console.log(`Telegram webhook: deleted revert branch ${prDetails.headBranch}`);
        } catch {
            console.log('Telegram webhook: revert branch already deleted or not found');
        }

        // Update the original message
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const mergedNote = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Revert PR Merged</b>',
                'Changes have been reverted on main.',
                '',
                '<b>Next steps:</b>',
                `1️⃣ Go to Issue #${issueNumber} and add a comment explaining what went wrong`,
                '2️⃣ Run <code>yarn agent:implement</code> - the agent will read your feedback and create a new PR',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + mergedNote,
                'HTML'
            );
        }

        console.log(`Telegram webhook: completed merge revert PR #${revertPrNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error merging revert PR:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle design PR approval callback
 * Callback format: "design_approve:prNumber:issueNumber:type"
 * where type is "product-dev", "product", or "tech"
 *
 * Actions:
 * 1. Merge the design PR (squash)
 * 2. Update artifact comment on issue
 * 3. Advance status to next phase
 * 4. For tech design: post phases comment and initialize implementation phases
 */
async function handleDesignPRApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    prNumber: number,
    issueNumber: number,
    designType: 'product-dev' | 'product' | 'tech'
): Promise<{ success: boolean; error?: string }> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Log phase start
        const designLabel = designType === 'product-dev'
            ? 'Product Development'
            : designType === 'product'
                ? 'Product Design'
                : 'Technical Design';
        if (logExists(issueNumber)) {
            logWebhookPhaseStart(issueNumber, `${designLabel} PR Merge`, 'telegram');
        }

        // 1. Generate commit message for design PR
        const docType = designType === 'product-dev' ? 'product development' : designType;
        const commitTitle = `docs: ${docType} for issue #${issueNumber}`;
        const commitBody = `Approved ${docType} document.\n\nPart of #${issueNumber}`;

        // 2. Merge the design PR
        await adapter.mergePullRequest(prNumber, commitTitle, commitBody);

        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'design_pr_merged', `${designLabel} PR #${prNumber} merged`, {
                prNumber,
                designType,
                commitTitle,
            });
        }

        // 3. Update artifact comment on issue (only for product/tech, not product-dev)
        // Product Development documents don't need artifact tracking - they're just context for Product Design
        if (designType !== 'product-dev') {
            const isProductDesign = designType === 'product';
            await updateDesignArtifact(adapter, issueNumber, {
                type: isProductDesign ? 'product-design' : 'tech-design',
                path: getDesignDocLink(issueNumber, designType),
                status: 'approved',
                lastUpdated: new Date().toISOString().split('T')[0],
                prNumber,
            });
            console.log(`Telegram webhook: updated design artifact for issue #${issueNumber}`);
        }

        // 4. Advance status to next phase
        const nextPhase = designType === 'product-dev'
            ? STATUSES.productDesign
            : designType === 'product'
                ? STATUSES.techDesign
                : STATUSES.implementation;
        const nextPhaseLabel = designType === 'product-dev'
            ? 'Product Design'
            : designType === 'product'
                ? 'Tech Design'
                : 'Implementation';

        // Find and update the project item
        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (item) {
            // Update status to next phase
            await adapter.updateItemStatus(item.itemId, nextPhase);
            console.log(`Telegram webhook: advanced status to ${nextPhase}`);

            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'status_advanced', `Status advanced to ${nextPhaseLabel}`, {
                    from: item.status,
                    to: nextPhase,
                });
            }

            // Clear review status
            if (adapter.hasReviewStatusField() && item.reviewStatus) {
                await adapter.clearItemReviewStatus(item.itemId);
                console.log(`Telegram webhook: cleared review status`);
            }

            // Delete the design branch
            const prDetails = await adapter.getPRDetails(prNumber);
            if (prDetails?.headBranch) {
                await adapter.deleteBranch(prDetails.headBranch);
                console.log(`Telegram webhook: deleted branch ${prDetails.headBranch}`);
                if (logExists(issueNumber)) {
                    logWebhookAction(issueNumber, 'branch_deleted', `Branch ${prDetails.headBranch} deleted`, {
                        branch: prDetails.headBranch,
                    });
                }
            }

            // For tech design PRs, handle phases for multi-PR workflow
            if (designType === 'tech') {
                const techDesign = readDesignDoc(issueNumber, 'tech');
                if (techDesign) {
                    const phases = parsePhasesFromMarkdown(techDesign);
                    if (phases && phases.length >= 2) {
                        // Post phases comment on issue (for implementation agent to read)
                        const issueComments = await adapter.getIssueComments(issueNumber);
                        if (!hasPhaseComment(issueComments)) {
                            const phasesComment = formatPhasesToComment(phases);
                            await adapter.addIssueComment(issueNumber, phasesComment);
                            console.log(`Telegram webhook: posted phases comment (${phases.length} phases)`);
                        }

                        // Initialize implementation phases in artifact comment
                        await initializeImplementationPhases(
                            adapter,
                            issueNumber,
                            phases.map(p => ({ order: p.order, name: p.name }))
                        );
                        console.log(`Telegram webhook: initialized implementation phases`);

                        if (logExists(issueNumber)) {
                            logWebhookAction(issueNumber, 'phases_initialized', `Initialized ${phases.length} implementation phases`, {
                                phases: phases.map(p => ({ order: p.order, name: p.name })),
                            });
                        }
                    }
                }
            }
        } else {
            console.warn(`Telegram webhook: project item not found for issue #${issueNumber}`);
        }

        // Log phase end
        if (logExists(issueNumber)) {
            logWebhookPhaseEnd(issueNumber, `${designLabel} PR Merge`, 'success', 'telegram');
        }

        // 4. Update the message to show success
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Merged Successfully!</b>',
                `${designLabel} PR #${prNumber} merged.`,
                `📊 Status: ${nextPhaseLabel}`,
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                'HTML'
            );
        }

        console.log(`Telegram webhook: merged ${designType} design PR #${prNumber} for issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error handling design PR approval:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle design PR request changes callback
 * Callback format: "design_changes:prNumber:issueNumber:type"
 * where type is "product-dev", "product", or "tech"
 *
 * Actions:
 * 1. Update review status to "Request Changes"
 * 2. Design agent will pick it up on next run
 */
async function handleDesignPRRequestChanges(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    prNumber: number,
    issueNumber: number,
    designType: 'product-dev' | 'product' | 'tech'
): Promise<{ success: boolean; error?: string }> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // 1. Find the project item
        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (!item) {
            return { success: false, error: `Issue #${issueNumber} not found in project.` };
        }

        // 2. Update review status to Request Changes
        await adapter.updateItemReviewStatus(item.itemId, REVIEW_STATUSES.requestChanges);

        // Log the request changes action
        const designLabel = designType === 'product-dev'
            ? 'Product Development'
            : designType === 'product'
                ? 'Product Design'
                : 'Technical Design';
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'design_changes_requested', `Changes requested on ${designLabel} PR #${prNumber}`, {
                prNumber,
                designType,
                reviewStatus: REVIEW_STATUSES.requestChanges,
            });
        }

        // 3. Update the message with instructions and undo button
        const prUrl = getPrUrl(prNumber);
        const timestamp = Date.now();
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '🔄 <b>Changes Requested</b>',
                '',
                `📊 Status: ${item.status}`,
                `📋 Review Status: ${REVIEW_STATUSES.requestChanges}`,
                '',
                `<b>Next:</b> <a href="${prUrl}">Comment on the ${designLabel} PR</a> explaining what needs to change.`,
                'Design agent will revise on next run.',
                '',
                '<i>Changed your mind? Click Undo within 5 minutes.</i>',
            ].join('\n');

            // u_dc = undo design changes
            const undoCallback = `u_dc:${prNumber}:${issueNumber}:${designType}:${timestamp}`;
            await editMessageWithUndoButton(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                undoCallback,
                timestamp
            );
        }

        console.log(`Telegram webhook: requested changes for ${designType} design PR #${prNumber}, issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error handling design PR request changes:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle request changes callback from Telegram (admin requests changes after PR approval)
 * Callback format: "reqchanges:issueNumber:prNumber"
 */
async function handleRequestChangesCallback(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number
): Promise<{ success: boolean; error?: string }> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // 1. Find the project item
        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (!item) {
            return { success: false, error: `Issue #${issueNumber} not found in project.` };
        }

        // 2. Move back to Implementation with Request Changes
        await adapter.updateItemStatus(item.itemId, STATUSES.implementation);
        await adapter.updateItemReviewStatus(item.itemId, REVIEW_STATUSES.requestChanges);

        // Log the request changes action
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'implementation_changes_requested', `Changes requested on PR #${prNumber}`, {
                prNumber,
                status: STATUSES.implementation,
                reviewStatus: REVIEW_STATUSES.requestChanges,
            });
        }

        // 3. Update the message with instructions and undo button
        const prUrl = getPrUrl(prNumber);
        const timestamp = Date.now();
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '🔄 <b>Marked for Changes</b>',
                '',
                `📊 Status: ${STATUSES.implementation}`,
                `📋 Review Status: ${REVIEW_STATUSES.requestChanges}`,
                '',
                `<b>Next:</b> <a href="${prUrl}">Comment on the PR</a> explaining what needs to change.`,
                'Implementor will pick it up on next run.',
                '',
                '<i>Changed your mind? Click Undo within 5 minutes.</i>',
            ].join('\n');

            // u_rc = undo request changes (implementation PR)
            const undoCallback = `u_rc:${issueNumber}:${prNumber}:${timestamp}`;
            await editMessageWithUndoButton(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                undoCallback,
                timestamp
            );
        }

        console.log(`Telegram webhook: requested changes for PR #${prNumber}, issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error handling request changes:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle undo for implementation PR request changes
 * Callback format: "u_rc:issueNumber:prNumber:timestamp"
 *
 * Restores status to PR Review and re-sends the PR Ready notification
 */
async function handleUndoRequestChanges(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number,
    timestamp: number
): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if undo is still valid
        if (!isUndoValid(timestamp)) {
            return { success: false, error: 'Undo window expired (5 minutes)' };
        }

        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // 1. Find the project item
        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (!item) {
            return { success: false, error: `Issue #${issueNumber} not found in project.` };
        }

        // 2. Restore status to PR Review and clear review status
        await adapter.updateItemStatus(item.itemId, STATUSES.prReview);
        await adapter.clearItemReviewStatus(item.itemId);

        // 3. Log the undo action
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'undo_request_changes', `Undid request changes for PR #${prNumber}`, {
                prNumber,
                restoredStatus: STATUSES.prReview,
            });
        }

        // 4. Update the message to show undo was successful
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            // Find and remove the undo-related text
            const cleanedText = originalText
                .replace(/\n*<i>Changed your mind\?.*<\/i>/g, '')
                .replace(/\n*Changed your mind\?.*5 minutes\./g, '');

            const undoConfirmation = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '↩️ <b>Undone!</b>',
                '',
                `📊 Status restored to: ${STATUSES.prReview}`,
                '📋 Review Status: (cleared)',
                '',
                'Re-sending PR Ready notification...',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(cleanedText) + undoConfirmation,
                'HTML'
            );
        }

        // 5. Re-send the PR Ready notification with buttons
        // First, get the commit message from the PR
        const { Octokit } = await import('@octokit/rest');
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        const { getProjectConfig } = await import('@/server/project-management/config');
        const projectConfig = getProjectConfig();
        const { owner, repo } = projectConfig.github;

        // Get PR details
        const { data: pr } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        // Get commit message from PR comments
        const { data: comments } = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: prNumber,
        });

        let commitMessage = { title: pr.title, body: pr.body || '' };
        for (const comment of comments) {
            if (comment.body?.includes(COMMIT_MESSAGE_MARKER)) {
                const parsed = parseCommitMessageComment(comment.body);
                if (parsed) {
                    commitMessage = parsed;
                    break;
                }
            }
        }

        // Re-send the notification
        const { notifyPRReadyToMerge } = await import('@/agents/shared/notifications');
        await notifyPRReadyToMerge(
            item.title,
            issueNumber,
            prNumber,
            commitMessage,
            'feature' // Default to feature, could be improved
        );

        console.log(`Telegram webhook: undid request changes for PR #${prNumber}, issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error handling undo request changes:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle undo for design PR request changes
 * Callback format: "u_dc:prNumber:issueNumber:designType:timestamp"
 *
 * Clears review status and re-sends the Design PR Ready notification
 */
async function handleUndoDesignChanges(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    prNumber: number,
    issueNumber: number,
    designType: 'product-dev' | 'product' | 'tech',
    timestamp: number
): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if undo is still valid
        if (!isUndoValid(timestamp)) {
            return { success: false, error: 'Undo window expired (5 minutes)' };
        }

        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // 1. Find the project item
        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (!item) {
            return { success: false, error: `Issue #${issueNumber} not found in project.` };
        }

        // 2. Clear review status (design status unchanged)
        await adapter.clearItemReviewStatus(item.itemId);

        const designLabel = designType === 'product-dev'
            ? 'Product Development'
            : designType === 'product'
                ? 'Product Design'
                : 'Technical Design';

        // 3. Log the undo action
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'undo_design_changes', `Undid request changes for ${designLabel} PR #${prNumber}`, {
                prNumber,
                designType,
            });
        }

        // 4. Update the message to show undo was successful
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const cleanedText = originalText
                .replace(/\n*<i>Changed your mind\?.*<\/i>/g, '')
                .replace(/\n*Changed your mind\?.*5 minutes\./g, '');

            const undoConfirmation = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '↩️ <b>Undone!</b>',
                '',
                `📊 Status: ${item.status}`,
                '📋 Review Status: (cleared)',
                '',
                'Re-sending Design PR Ready notification...',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(cleanedText) + undoConfirmation,
                'HTML'
            );
        }

        // 5. Re-send the Design PR Ready notification with buttons
        const { notifyDesignPRReady } = await import('@/agents/shared/notifications');
        await notifyDesignPRReady(
            designType,
            item.title,
            issueNumber,
            prNumber,
            false, // Not a revision since we're undoing
            'feature' // Default to feature
        );

        console.log(`Telegram webhook: undid design changes for ${designType} PR #${prNumber}, issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error handling undo design changes:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle undo for design review (changes/reject)
 * Callback format: "u_dr:issueNumber:action:previousStatus:timestamp"
 *
 * Clears review status and re-sends the design review notification
 */
async function handleUndoDesignReview(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    originalAction: 'changes' | 'reject',
    previousStatus: string,
    timestamp: number
): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if undo is still valid
        if (!isUndoValid(timestamp)) {
            return { success: false, error: 'Undo window expired (5 minutes)' };
        }

        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // 1. Find the project item
        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (!item) {
            return { success: false, error: `Issue #${issueNumber} not found in project.` };
        }

        // 2. Clear review status
        await adapter.clearItemReviewStatus(item.itemId);

        // 3. Log the undo action
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'undo_design_review', `Undid ${originalAction} for design review`, {
                issueNumber,
                originalAction,
                status: item.status,
            });
        }

        // 4. Update the message to show undo was successful
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const cleanedText = originalText
                .replace(/\n*<i>Changed your mind\?.*<\/i>/g, '')
                .replace(/\n*Changed your mind\?.*5 minutes\./g, '');

            const undoConfirmation = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '↩️ <b>Undone!</b>',
                '',
                `📊 Status: ${item.status}`,
                '📋 Review Status: (cleared)',
                '',
                'Re-sending review notification...',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(cleanedText) + undoConfirmation,
                'HTML'
            );
        }

        // 5. Re-send the appropriate notification based on the current status
        const { getIssueUrl } = await import('@/server/project-management/config');
        const issueUrl = getIssueUrl(issueNumber);

        // Send a new message with the review buttons
        await sendNotificationToOwner(
            `<b>🔄 Review Restored</b>\n\n📋 ${escapeHtml(item.title)}\n🔗 Issue #${issueNumber}\n📊 Status: ${item.status}\n\nReady for review again.`,
            {
                parseMode: 'HTML',
                inlineKeyboard: [
                    [
                        { text: '📋 View Issue', url: issueUrl },
                    ],
                    [
                        { text: '✅ Approve', callback_data: `approve:${issueNumber}` },
                        { text: '📝 Request Changes', callback_data: `changes:${issueNumber}` },
                        { text: '❌ Reject', callback_data: `reject:${issueNumber}` },
                    ],
                ],
            }
        );

        console.log(`Telegram webhook: undid ${originalAction} for issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error('Error handling undo design review:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error('Telegram webhook: missing TELEGRAM_BOT_TOKEN');
        return res.status(500).json({ error: 'Bot token not configured' });
    }

    const update: TelegramUpdate = req.body;

    // Only handle callback queries (button clicks)
    if (!update.callback_query) {
        return res.status(200).json({ ok: true });
    }

    const { callback_query } = update;
    const callbackData = callback_query.data;

    if (!callbackData) {
        await answerCallbackQuery(botToken, callback_query.id, 'Invalid callback');
        return res.status(200).json({ ok: true });
    }

    // Parse callback data with defensive parsing
    const parsed = parseCallbackData(callbackData);
    const { action, parts } = parsed;

    try {
        // Route to appropriate handler based on action type
        if (action === 'approve_request' && parts.length === 2) {
            // Initial feature request approval: "approve_request:requestId"
            const requestId = parsed.getString(1);

            if (!requestId) {
                console.error('Telegram webhook: Invalid approve_request callback data', {
                    callbackData,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid request ID');
                return res.status(200).json({ ok: true });
            }
            const result = await handleFeatureRequestApproval(
                botToken,
                callback_query,
                requestId
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Approved!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
                // Edit message to show error
                if (callback_query.message) {
                    await editMessageWithResult(
                        botToken,
                        callback_query.message.chat.id,
                        callback_query.message.message_id,
                        callback_query.message.text || '',
                        false,
                        result.error || 'Unknown error'
                    );
                }
            }

            return res.status(200).json({ ok: true });
        }

        // Bug report approval: "approve_bug:reportId"
        if (action === 'approve_bug' && parts.length === 2) {
            const reportId = parsed.getString(1);

            if (!reportId) {
                console.error('Telegram webhook: Invalid approve_bug callback data', {
                    callbackData,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid report ID');
                return res.status(200).json({ ok: true });
            }
            const result = await handleBugReportApproval(
                botToken,
                callback_query,
                reportId
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Approved!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
                // Edit message to show error
                if (callback_query.message) {
                    await editMessageWithResult(
                        botToken,
                        callback_query.message.chat.id,
                        callback_query.message.message_id,
                        callback_query.message.text || '',
                        false,
                        result.error || 'Unknown error'
                    );
                }
            }

            return res.status(200).json({ ok: true });
        }

        // Feature routing: "route_feature:requestId:destination"
        if (action === 'route_feature' && parts.length === 3) {
            const requestId = parsed.getString(1);
            const destination = parsed.getString(2);

            if (!requestId || !destination) {
                console.error('Telegram webhook: Invalid route_feature callback data', {
                    callbackData,
                    requestId,
                    destination,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid routing data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleFeatureRouting(
                botToken,
                callback_query,
                requestId,
                destination
            );

            if (!result.success) {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Bug routing: "route_bug:reportId:destination"
        if (action === 'route_bug' && parts.length === 3) {
            const reportId = parsed.getString(1);
            const destination = parsed.getString(2);

            if (!reportId || !destination) {
                console.error('Telegram webhook: Invalid route_bug callback data', {
                    callbackData,
                    reportId,
                    destination,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid routing data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleBugRouting(
                botToken,
                callback_query,
                reportId,
                destination
            );

            if (!result.success) {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Design review actions: "approve:123", "changes:123", "reject:123"
        if (['approve', 'changes', 'reject'].includes(action) && parts.length === 2) {
            const issueNumber = parsed.getInt(1);

            if (!issueNumber) {
                console.error('Telegram webhook: Invalid design review callback data', {
                    callbackData,
                    action,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue number');
                return res.status(200).json({ ok: true });
            }

            const result = await handleDesignReviewAction(
                botToken,
                callback_query,
                action as ReviewAction,
                issueNumber
            );

            if (!result.success) {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Clarification received: "clarified:123"
        if (action === 'clarified' && parts.length === 2) {
            const issueNumber = parsed.getInt(1);

            if (!issueNumber) {
                console.error('Telegram webhook: Invalid clarified callback data', {
                    callbackData,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue number');
                return res.status(200).json({ ok: true });
            }

            const result = await handleClarificationReceived(
                botToken,
                callback_query,
                issueNumber
            );

            if (!result.success) {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Merge PR: "merge:issueNumber:prNumber"
        if (action === 'merge' && parts.length === 3) {
            const issueNumber = parsed.getInt(1);
            const prNumber = parsed.getInt(2);

            if (!issueNumber || !prNumber) {
                console.error('Telegram webhook: Invalid merge callback data', {
                    callbackData,
                    issueNumber,
                    prNumber,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue or PR number');
                return res.status(200).json({ ok: true });
            }

            const result = await handleMergeCallback(
                botToken,
                callback_query,
                issueNumber,
                prNumber
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Merged!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Merge Final PR (feature branch workflow): "merge_final:issueNumber:prNumber"
        if (action === 'merge_final' && parts.length === 3) {
            const issueNumber = parsed.getInt(1);
            const prNumber = parsed.getInt(2);

            if (!issueNumber || !prNumber) {
                console.error('Telegram webhook: Invalid merge_final callback data', {
                    callbackData,
                    issueNumber,
                    prNumber,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue or PR number');
                return res.status(200).json({ ok: true });
            }

            const result = await handleMergeFinalPRCallback(
                botToken,
                callback_query,
                issueNumber,
                prNumber
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Final PR Merged!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Request changes (admin requests changes after approval): "reqchanges:issueNumber:prNumber"
        if (action === 'reqchanges' && parts.length === 3) {
            const issueNumber = parsed.getInt(1);
            const prNumber = parsed.getInt(2);

            if (!issueNumber || !prNumber) {
                console.error('Telegram webhook: Invalid reqchanges callback data', {
                    callbackData,
                    issueNumber,
                    prNumber,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue or PR number');
                return res.status(200).json({ ok: true });
            }

            const result = await handleRequestChangesCallback(
                botToken,
                callback_query,
                issueNumber,
                prNumber
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '🔄 Marked for changes');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Design PR approval: "design_approve:prNumber:issueNumber:type"
        if (action === 'design_approve' && parts.length === 4) {
            const prNumber = parsed.getInt(1);
            const issueNumber = parsed.getInt(2);
            const designType = parsed.getString(3).toLowerCase() as 'product-dev' | 'product' | 'tech';

            if (!prNumber || !issueNumber || !['product-dev', 'product', 'tech'].includes(designType)) {
                console.error('Telegram webhook: Invalid design_approve callback data', {
                    callbackData,
                    prNumber,
                    issueNumber,
                    designType,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid callback data');
                return res.status(200).json({ ok: true });
            }

            const result = await handleDesignPRApproval(
                botToken,
                callback_query,
                prNumber,
                issueNumber,
                designType
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Merged!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Design PR request changes: "design_changes:prNumber:issueNumber:type"
        if (action === 'design_changes' && parts.length === 4) {
            const prNumber = parsed.getInt(1);
            const issueNumber = parsed.getInt(2);
            const designType = parsed.getString(3).toLowerCase() as 'product-dev' | 'product' | 'tech';

            if (!prNumber || !issueNumber || !['product-dev', 'product', 'tech'].includes(designType)) {
                console.error('Telegram webhook: Invalid design_changes callback data', {
                    callbackData,
                    prNumber,
                    issueNumber,
                    designType,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid callback data');
                return res.status(200).json({ ok: true });
            }

            const result = await handleDesignPRRequestChanges(
                botToken,
                callback_query,
                prNumber,
                issueNumber,
                designType
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '🔄 Changes requested');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Revert merge: "rv:issueNumber:prNumber:shortSha:prevStatus:phase"
        if (action === 'rv' && parts.length >= 5) {
            const issueNumber = parsed.getInt(1);
            const prNumber = parsed.getInt(2);
            const shortSha = parsed.getString(3);
            const prevStatus = parsed.getString(4);
            const phase = parts.length >= 6 ? parsed.getString(5) : '';

            if (!issueNumber || !prNumber || !shortSha || !prevStatus) {
                console.error('Telegram webhook: Invalid revert callback data', {
                    callbackData,
                    issueNumber,
                    prNumber,
                    shortSha,
                    prevStatus,
                    phase,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid revert data');
                return res.status(200).json({ ok: true });
            }

            const result = await handleRevertMerge(
                botToken,
                callback_query,
                issueNumber,
                prNumber,
                shortSha,
                prevStatus,
                phase
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '↩️ Revert PR created!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Merge revert PR: "merge_rv:issueNumber:revertPrNumber"
        if (action === 'merge_rv' && parts.length === 3) {
            const issueNumber = parsed.getInt(1);
            const revertPrNumber = parsed.getInt(2);

            if (!issueNumber || !revertPrNumber) {
                console.error('Telegram webhook: Invalid merge_rv callback data', {
                    callbackData,
                    issueNumber,
                    revertPrNumber,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid merge data');
                return res.status(200).json({ ok: true });
            }

            const result = await handleMergeRevertPR(
                botToken,
                callback_query,
                issueNumber,
                revertPrNumber
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Revert PR merged!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Undo request changes (implementation PR): "u_rc:issueNumber:prNumber:timestamp"
        if (action === 'u_rc' && parts.length === 4) {
            const issueNumber = parsed.getInt(1);
            const prNumber = parsed.getInt(2);
            const timestamp = parsed.getInt(3);

            if (!issueNumber || !prNumber || !timestamp) {
                console.error('Telegram webhook: Invalid u_rc callback data', {
                    callbackData,
                    issueNumber,
                    prNumber,
                    timestamp,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid undo data');
                return res.status(200).json({ ok: true });
            }

            const result = await handleUndoRequestChanges(
                botToken,
                callback_query,
                issueNumber,
                prNumber,
                timestamp
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '↩️ Undone!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Undo design changes (design PR): "u_dc:prNumber:issueNumber:designType:timestamp"
        if (action === 'u_dc' && parts.length === 5) {
            const prNumber = parsed.getInt(1);
            const issueNumber = parsed.getInt(2);
            const designType = parsed.getString(3).toLowerCase() as 'product-dev' | 'product' | 'tech';
            const timestamp = parsed.getInt(4);

            if (!prNumber || !issueNumber || !['product-dev', 'product', 'tech'].includes(designType) || !timestamp) {
                console.error('Telegram webhook: Invalid u_dc callback data', {
                    callbackData,
                    prNumber,
                    issueNumber,
                    designType,
                    timestamp,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid undo data');
                return res.status(200).json({ ok: true });
            }

            const result = await handleUndoDesignChanges(
                botToken,
                callback_query,
                prNumber,
                issueNumber,
                designType,
                timestamp
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '↩️ Undone!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Undo design review (changes/reject): "u_dr:issueNumber:action:previousStatus:timestamp"
        if (action === 'u_dr' && parts.length === 5) {
            const issueNumber = parsed.getInt(1);
            const originalAction = parsed.getString(2) as 'changes' | 'reject';
            const previousStatus = parsed.getString(3);
            const timestamp = parsed.getInt(4);

            if (!issueNumber || !['changes', 'reject'].includes(originalAction) || !previousStatus || !timestamp) {
                console.error('Telegram webhook: Invalid u_dr callback data', {
                    callbackData,
                    issueNumber,
                    originalAction,
                    previousStatus,
                    timestamp,
                    parts,
                });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid undo data');
                return res.status(200).json({ ok: true });
            }

            const result = await handleUndoDesignReview(
                botToken,
                callback_query,
                issueNumber,
                originalAction,
                previousStatus,
                timestamp
            );

            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '↩️ Undone!');
            } else {
                await answerCallbackQuery(
                    botToken,
                    callback_query.id,
                    `❌ ${result.error?.slice(0, 150)}`
                );
            }

            return res.status(200).json({ ok: true });
        }

        // Unknown action - log for debugging
        console.error('Telegram webhook: Unknown action received', {
            callbackData: callbackData,
            action: action,
            parts: parts,
            partsLength: parts.length,
            callbackQueryId: callback_query.id,
            userId: callback_query.from.id,
            username: callback_query.from.username,
            messageId: callback_query.message?.message_id,
            timestamp: new Date().toISOString(),
        });

        await answerCallbackQuery(
            botToken,
            callback_query.id,
            `⚠️ Unknown action: ${callbackData.length > 50 ? `${callbackData.slice(0, 50)}...` : callbackData}`
        );

        // Edit message to show error details
        if (callback_query.message) {
            const originalText = callback_query.message.text || '';
            const errorMarkerPlainText = '⚠️ Unknown Action';

            // Prevent duplicate error messages if user clicks multiple times
            if (originalText.includes(errorMarkerPlainText)) {
                return res.status(200).json({ ok: true });
            }

            const errorDetails = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '⚠️ <b>Unknown Action</b>',
                '',
                `Received callback: <code>${escapeHtml(callbackData)}</code>`,
                `Action parsed: <code>${escapeHtml(action)}</code>`,
                '',
                'This action is not recognized by the webhook handler.',
                'Please try again or contact support if the issue persists.',
            ].join('\n');

            try {
                await editMessageText(
                    botToken,
                    callback_query.message.chat.id,
                    callback_query.message.message_id,
                    escapeHtml(originalText) + errorDetails,
                    'HTML'
                );
            } catch (editError) {
                console.error('Failed to edit message for unknown action:', {
                    error: editError instanceof Error ? editError.message : editError,
                    callbackData: callbackData,
                });
            }
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Show error toast
        await answerCallbackQuery(
            botToken,
            callback_query.id,
            `❌ Error: ${errorMessage.slice(0, 150)}`
        );

        // Edit message to show error
        if (callback_query.message) {
            await editMessageWithResult(
                botToken,
                callback_query.message.chat.id,
                callback_query.message.message_id,
                callback_query.message.text || '',
                false,
                errorMessage.slice(0, 200)
            );
        }

        return res.status(200).json({ ok: true });
    }
}
