/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Telegram Webhook API Endpoint
 *
 * Handles callback queries from inline keyboard buttons in Telegram notifications.
 * Supports multiple flows:
 *
 * 1. Initial Feature Request Approval:
 *    - Callback: "approve_request:requestId:token"
 *    - Creates GitHub issue from feature request
 *
 * 2. Design Review Actions (Product/Tech Design):
 *    - Callback: "approve:issueNumber" | "changes:issueNumber" | "reject:issueNumber"
 *    - Updates GitHub Project review status
 *
 * This is a direct API route because Telegram sends webhook requests directly to this URL.
 * It cannot go through the standard API architecture.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getProjectManagementAdapter } from '@/server/project-management';
import { STATUSES, REVIEW_STATUSES } from '@/server/project-management/config';
import { featureRequests, reports } from '@/server/database';
import { approveFeatureRequest, approveBugReport } from '@/server/github-sync';

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
 * Callback format: "approve_request:requestId:token"
 */
async function handleFeatureRequestApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    requestId: string,
    token: string
): Promise<{ success: boolean; error?: string }> {
    // Fetch the feature request
    const request = await featureRequests.findFeatureRequestById(requestId);

    if (!request) {
        return { success: false, error: 'Feature request not found' };
    }

    // Verify the token
    if (!request.approvalToken || request.approvalToken !== token) {
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
 * Callback format: "approve_bug:reportId:token"
 */
async function handleBugReportApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    reportId: string,
    token: string
): Promise<{ success: boolean; error?: string }> {
    // Fetch the bug report
    const report = await reports.findReportById(reportId);

    if (!report) {
        return { success: false, error: 'Bug report not found' };
    }

    // Verify the token
    if (!report.approvalToken || report.approvalToken !== token) {
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

    // Update the message with success
    if (callbackQuery.message) {
        const description = report.description?.slice(0, 50) || 'Bug Report';
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
            await adapter.updateItemReviewStatus(item.itemId, '');
            advancedTo = nextStatus;
            finalStatus = nextStatus;
            finalReviewStatus = '';
            console.log(`Telegram webhook: auto-advanced to ${nextStatus}`);
        }
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
    // - "approve_request:requestId:token" - Initial feature request approval
    // - "action:issueNumber" - Design review actions
    const parts = callbackData.split(':');
    const action = parts[0];

    try {
        // Route to appropriate handler based on action type
        if (action === 'approve_request' && parts.length === 3) {
            // Initial feature request approval: "approve_request:requestId:token"
            const [, requestId, token] = parts;
            const result = await handleFeatureRequestApproval(
                botToken,
                callback_query,
                requestId,
                token
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

        // Bug report approval: "approve_bug:reportId:token"
        if (action === 'approve_bug' && parts.length === 3) {
            const [, reportId, token] = parts;
            const result = await handleBugReportApproval(
                botToken,
                callback_query,
                reportId,
                token
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
