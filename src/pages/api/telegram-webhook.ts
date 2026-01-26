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
 * This is a direct API route because Telegram sends webhook requests directly to this URL.
 * It cannot go through the standard API architecture.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectManagementAdapter } from '@/server/project-management';
import { STATUSES, REVIEW_STATUSES, COMMIT_MESSAGE_MARKER } from '@/server/project-management/config';
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
 * Edit the original message to show the action taken (for design review)
 */
async function editMessageTextWithExtra(
    botToken: string,
    chatId: number,
    messageId: number,
    originalText: string,
    action: ReviewAction,
    extraInfo: string = ''
): Promise<void> {
    const emoji = ACTION_EMOJIS[action];
    const label = ACTION_LABELS[action];

    // Append the action to the original message
    const newText = `${originalText}\n\n${emoji} <b>${label}</b>${extraInfo}`;

    await fetch(`${TELEGRAM_API_URL}${botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: newText,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            // Remove the inline keyboard after action
            reply_markup: { inline_keyboard: [] },
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

    let newText = `${originalText}\n\n${emoji} <b>${status}</b>\n${resultMessage}`;
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
    const newText = `${originalText}\n\n✅ <b>Routed to: ${destination}</b>`;

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
    await adapter.updateItemStatus(request.githubProjectItemId, targetStatus);

    // Clear review status if moving to a phase that agents process
    if (destination !== 'backlog' && adapter.hasReviewStatusField()) {
        await adapter.clearItemReviewStatus(request.githubProjectItemId);
    }

    // Acknowledge callback
    const destinationLabels: Record<string, string> = {
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
    if (action === 'approve') {
        if (advancedTo) {
            statusDetails = `\n\n✅ <b>Success!</b>\n📊 Status: ${advancedTo}\n📋 Review Status: (ready for agent)`;
        } else {
            // Implementation phase - no auto-advance
            statusDetails = `\n\n✅ <b>Success!</b>\n📊 Status: ${finalStatus}\n📋 Review Status: ${finalReviewStatus}\n\n💡 Merge the PR to complete.`;
        }
    } else if (action === 'changes') {
        statusDetails = `\n\n📝 <b>Changes Requested</b>\n📊 Status: ${finalStatus}\n📋 Review Status: ${finalReviewStatus}\n\n💡 Add comments on the issue, then run agents.`;
    } else if (action === 'reject') {
        statusDetails = `\n\n❌ <b>Rejected</b>\n📊 Status: ${finalStatus}\n📋 Review Status: ${finalReviewStatus}`;
    }

    // Acknowledge the button click (toast notification)
    const toastMessage = advancedTo
        ? `✅ Approved → ${advancedTo}`
        : `${ACTION_EMOJIS[action]} ${ACTION_LABELS[action]}`;
    await answerCallbackQuery(botToken, callbackQuery.id, toastMessage);

    // Edit the message to show the action taken with full details
    if (callbackQuery.message) {
        await editMessageTextWithExtra(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            action,
            statusDetails
        );
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
                originalText + statusUpdate,
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
        try {
            await adapter.mergePullRequest(prNumber, commitMsg.title, commitMsg.body);
            console.log(`Telegram webhook: merged PR #${prNumber}`);
            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'pr_merged', `PR #${prNumber} squash-merged`, {
                    prNumber,
                    commitTitle: commitMsg.title,
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
                if (logExists(issueNumber)) {
                    logWebhookAction(issueNumber, 'pr_already_merged', `PR #${prNumber} was already merged`, {
                        prNumber,
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
            // Still return success if PR was merged - issue just wasn't in project
            if (alreadyMerged || !commitComment) {
                return { success: true };
            }
        }

        // 4. Check for multi-phase implementation
        const phase = item ? await adapter.getImplementationPhase(item.itemId) : null;
        const parsedPhase = parsePhaseString(phase);

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
            console.log(`Telegram webhook: Multi-phase feature: Phase ${parsedPhase.current}/${parsedPhase.total}`);

            // Update artifact comment to mark phase as merged
            try {
                await updateImplementationPhaseArtifact(
                    adapter,
                    issueNumber,
                    parsedPhase.current,
                    parsedPhase.total,
                    phaseName,
                    'merged',
                    prNumber
                );
                console.log('Telegram webhook: updated artifact comment - phase marked as merged');
            } catch (artifactError) {
                console.warn('Telegram webhook: failed to update artifact comment:', artifactError);
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
                // Final phase - mark as Done
                console.log(`Telegram webhook: All ${parsedPhase.total} phases complete!`);

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
        } else if (item) {
            // Single-phase feature
            try {
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
                console.log('Telegram webhook: updated artifact comment - implementation marked as merged');
            } catch (artifactError) {
                console.warn('Telegram webhook: failed to update artifact comment:', artifactError);
            }

            // Post completion comment
            const completionComment = `✅ Merged PR #${prNumber} - Issue complete!`;
            await adapter.addIssueComment(issueNumber, completionComment);

            statusMessage = '📊 Status: Done';
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
                originalText + statusUpdate,
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
 * Handle design PR approval callback
 * Callback format: "design_approve:prNumber:issueNumber:type"
 * where type is "product" or "tech"
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
    designType: 'product' | 'tech'
): Promise<{ success: boolean; error?: string }> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Log phase start
        const designLabel = designType === 'product' ? 'Product Design' : 'Technical Design';
        if (logExists(issueNumber)) {
            logWebhookPhaseStart(issueNumber, `${designLabel} PR Merge`, 'telegram');
        }

        // 1. Generate commit message for design PR
        const commitTitle = `docs: ${designType} design for issue #${issueNumber}`;
        const commitBody = `Approved ${designType} design document.\n\nPart of #${issueNumber}`;

        // 2. Merge the design PR
        await adapter.mergePullRequest(prNumber, commitTitle, commitBody);

        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'design_pr_merged', `${designLabel} PR #${prNumber} merged`, {
                prNumber,
                designType,
                commitTitle,
            });
        }

        // 3. Update artifact comment on issue
        const isProductDesign = designType === 'product';
        await updateDesignArtifact(adapter, issueNumber, {
            type: isProductDesign ? 'product-design' : 'tech-design',
            path: getDesignDocLink(issueNumber, designType),
            status: 'approved',
            lastUpdated: new Date().toISOString().split('T')[0],
            prNumber,
        });
        console.log(`Telegram webhook: updated design artifact for issue #${issueNumber}`);

        // 4. Advance status to next phase
        const nextPhase = designType === 'product' ? STATUSES.techDesign : STATUSES.implementation;
        const nextPhaseLabel = designType === 'product' ? 'Tech Design' : 'Implementation';

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
                originalText + statusUpdate,
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
 * where type is "product" or "tech"
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
    designType: 'product' | 'tech'
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
        const designLabel = designType === 'product' ? 'Product Design' : 'Technical Design';
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'design_changes_requested', `Changes requested on ${designLabel} PR #${prNumber}`, {
                prNumber,
                designType,
                reviewStatus: REVIEW_STATUSES.requestChanges,
            });
        }

        // 3. Update the message with instructions
        const prUrl = getPrUrl(prNumber);
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
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                originalText + statusUpdate,
                'HTML'
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

        // 3. Update the message with instructions
        const prUrl = getPrUrl(prNumber);
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
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                originalText + statusUpdate,
                'HTML'
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

    // Parse callback data - supports multiple formats:
    // - "approve_request:requestId" - Initial feature request approval
    // - "action:issueNumber" - Design review actions
    const parts = callbackData.split(':');
    const action = parts[0];

    try {
        // Route to appropriate handler based on action type
        if (action === 'approve_request' && parts.length === 2) {
            // Initial feature request approval: "approve_request:requestId"
            const [, requestId] = parts;
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
            const [, reportId] = parts;
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
            const [, requestId, destination] = parts;
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
            const [, reportId, destination] = parts;
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
            const issueNumber = parseInt(parts[1], 10);

            if (!issueNumber) {
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
            const issueNumber = parseInt(parts[1], 10);

            if (!issueNumber) {
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
            const issueNumber = parseInt(parts[1], 10);
            const prNumber = parseInt(parts[2], 10);

            if (!issueNumber || !prNumber) {
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

        // Request changes (admin requests changes after approval): "reqchanges:issueNumber:prNumber"
        if (action === 'reqchanges' && parts.length === 3) {
            const issueNumber = parseInt(parts[1], 10);
            const prNumber = parseInt(parts[2], 10);

            if (!issueNumber || !prNumber) {
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
            const prNumber = parseInt(parts[1], 10);
            const issueNumber = parseInt(parts[2], 10);
            const designType = parts[3] as 'product' | 'tech';

            if (!prNumber || !issueNumber || !['product', 'tech'].includes(designType)) {
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
            const prNumber = parseInt(parts[1], 10);
            const issueNumber = parseInt(parts[2], 10);
            const designType = parts[3] as 'product' | 'tech';

            if (!prNumber || !issueNumber || !['product', 'tech'].includes(designType)) {
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

        // Unknown action
        await answerCallbackQuery(botToken, callback_query.id, 'Unknown action');
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
