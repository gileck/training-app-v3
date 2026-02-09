/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Telegram Webhook API Endpoint
 *
 * Handles callback queries from inline keyboard buttons in Telegram notifications.
 * Supports multiple flows:
 *
 * 1. Initial Feature Request / Bug Report Approval:
 *    - Callback: "approve_request:requestId" - Creates GitHub issue from feature request
 *    - Callback: "approve_bug:reportId" - Creates GitHub issue from bug report
 *    - Callback: "approve_request_bl:requestId" - Creates GitHub issue and parks in Backlog
 *    - Callback: "approve_bug_bl:reportId" - Creates GitHub issue and parks in Backlog
 *
 * 2. Delete Feature Request / Bug Report:
 *    - Callback: "delete_request:requestId" - Delete feature request from MongoDB
 *    - Callback: "delete_bug:reportId" - Delete bug report from MongoDB
 *
 * 3. Design Review Actions (Product/Tech Design):
 *    - Callback: "approve:issueNumber" | "changes:issueNumber" | "reject:issueNumber"
 *    - Updates GitHub Project review status
 *
 * 4. PR Merge Flow (after PR Review approval):
 *    - Callback: "merge:issueNumber:prNumber" - Squash merge PR with saved commit message
 *    - Callback: "reqchanges:issueNumber:prNumber" - Send back to implementation
 *
 * 5. Clarification Flow:
 *    - Callback: "clarified:issueNumber" - Mark clarification as received
 *
 * 6. Routing (after initial sync):
 *    - Callback: "route_feature:requestId:destination" | "route_bug:reportId:destination"
 *
 * 7. Undo Actions (5-minute window to revert accidental clicks):
 *    - Callback: "u_rc:issueNumber:prNumber:timestamp" - Undo implementation PR request changes
 *    - Callback: "u_dc:prNumber:issueNumber:type:timestamp" - Undo design PR request changes
 *    - Callback: "u_dr:issueNumber:action:previousStatus:timestamp" - Undo design review changes/reject
 *
 * 8. Revert Merge:
 *    - Callback: "rv:issueNumber:prNumber:shortSha:prevStatus:phase" - Create revert PR and reset status
 *    - Callback: "merge_rv:issueNumber:revertPrNumber" - Merge the revert PR
 *
 * This is a direct API route because Telegram sends webhook requests directly to this URL.
 * It cannot go through the standard API architecture.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { answerCallbackQuery, editMessageText, editMessageWithResult } from './telegram-api';
import { parseCallbackData, escapeHtml } from './utils';
import {
    handleFeatureRequestApproval,
    handleBugReportApproval,
    handleFeatureRequestDeletion,
    handleBugReportDeletion,
    handleFeatureRequestApprovalToBacklog,
    handleBugReportApprovalToBacklog,
    handleFeatureRouting,
    handleBugRouting,
    handleDesignReviewAction,
    handleClarificationReceived,
    handleMergeCallback,
    handleMergeFinalPRCallback,
    handleRevertMerge,
    handleMergeRevertPR,
    handleDesignPRApproval,
    handleDesignPRRequestChanges,
    handleRequestChangesCallback,
    handleUndoRequestChanges,
    handleUndoDesignChanges,
    handleUndoDesignReview,
} from './handlers';
import type { TelegramUpdate, ReviewAction, DesignType } from './types';
import { flushPendingLogs } from '@/agents/lib/logging';

/**
 * Maximum time (ms) to wait for handler processing before returning a response.
 * Set below Vercel's serverless function timeout (default 60s for Pro, 10s for Hobby)
 * to ensure the user always gets a response and doesn't see a frozen loading state.
 */
const HANDLER_TIMEOUT_MS = 25_000;

/**
 * Run a handler function with a timeout. If the handler does not complete
 * within the timeout, a warning is logged but no error is thrown - the
 * response will be sent regardless. The handler continues running in the
 * remaining serverless function time.
 */
async function withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    label: string
): Promise<{ result: T | null; timedOut: boolean }> {
    let timedOut = false;
    const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
            timedOut = true;
            console.warn(`[WEBHOOK:TIMEOUT] Handler "${label}" exceeded ${timeoutMs}ms timeout`);
            resolve(null);
        }, timeoutMs);
    });

    const result = await Promise.race([
        fn().then((r) => r),
        timeoutPromise,
    ]);

    return { result, timedOut };
}

/**
 * Process the callback query by routing to the appropriate handler.
 * Extracted from the main handler to enable timeout wrapping.
 */
async function processCallbackQuery(
    botToken: string,
    callback_query: TelegramUpdate['callback_query'] & { data: string },
    parsed: ReturnType<typeof parseCallbackData>,
): Promise<void> {
    const { action, parts } = parsed;
    const callbackData = callback_query.data;

    // Route to appropriate handler based on action type
    if (action === 'approve_request' && parts.length === 2) {
        const requestId = parsed.getString(1);
        if (!requestId) {
            console.error('Telegram webhook: Invalid approve_request callback data', { callbackData, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid request ID');
            return;
        }
        // Show loading state immediately
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Creating GitHub issue...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Creating GitHub issue...</b>', 'HTML');
        }
        const result = await handleFeatureRequestApproval(botToken, callback_query, requestId);
        if (!result.success && callback_query.message) {
            await editMessageWithResult(botToken, callback_query.message.chat.id, callback_query.message.message_id, callback_query.message.text || '', false, result.error || 'Unknown error');
        }
        return;
    }

    if (action === 'approve_bug' && parts.length === 2) {
        const reportId = parsed.getString(1);
        if (!reportId) {
            console.error('Telegram webhook: Invalid approve_bug callback data', { callbackData, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid report ID');
            return;
        }
        // Show loading state immediately
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Creating GitHub issue...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Creating GitHub issue...</b>', 'HTML');
        }
        const result = await handleBugReportApproval(botToken, callback_query, reportId);
        if (!result.success && callback_query.message) {
            await editMessageWithResult(botToken, callback_query.message.chat.id, callback_query.message.message_id, callback_query.message.text || '', false, result.error || 'Unknown error');
        }
        return;
    }

    if (action === 'approve_request_bl' && parts.length === 2) {
        const requestId = parsed.getString(1);
        if (!requestId) {
            console.error('Telegram webhook: Invalid approve_request_bl callback data', { callbackData, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid request ID');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Creating GitHub issue...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Creating GitHub issue...</b>', 'HTML');
        }
        const result = await handleFeatureRequestApprovalToBacklog(botToken, callback_query, requestId);
        if (!result.success && callback_query.message) {
            await editMessageWithResult(botToken, callback_query.message.chat.id, callback_query.message.message_id, callback_query.message.text || '', false, result.error || 'Unknown error');
        }
        return;
    }

    if (action === 'approve_bug_bl' && parts.length === 2) {
        const reportId = parsed.getString(1);
        if (!reportId) {
            console.error('Telegram webhook: Invalid approve_bug_bl callback data', { callbackData, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid report ID');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Creating GitHub issue...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Creating GitHub issue...</b>', 'HTML');
        }
        const result = await handleBugReportApprovalToBacklog(botToken, callback_query, reportId);
        if (!result.success && callback_query.message) {
            await editMessageWithResult(botToken, callback_query.message.chat.id, callback_query.message.message_id, callback_query.message.text || '', false, result.error || 'Unknown error');
        }
        return;
    }

    if (action === 'delete_request' && parts.length === 2) {
        const requestId = parsed.getString(1);
        if (!requestId) {
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid request ID');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Deleting...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Deleting...</b>', 'HTML');
        }
        const result = await handleFeatureRequestDeletion(botToken, callback_query, requestId);
        if (!result.success && callback_query.message) {
            await editMessageWithResult(botToken, callback_query.message.chat.id, callback_query.message.message_id, callback_query.message.text || '', false, result.error || 'Unknown error');
        }
        return;
    }

    if (action === 'delete_bug' && parts.length === 2) {
        const reportId = parsed.getString(1);
        if (!reportId) {
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid report ID');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Deleting...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Deleting...</b>', 'HTML');
        }
        const result = await handleBugReportDeletion(botToken, callback_query, reportId);
        if (!result.success && callback_query.message) {
            await editMessageWithResult(botToken, callback_query.message.chat.id, callback_query.message.message_id, callback_query.message.text || '', false, result.error || 'Unknown error');
        }
        return;
    }

    if (action === 'route_feature' && parts.length === 3) {
        const requestId = parsed.getString(1);
        const destination = parsed.getString(2);
        if (!requestId || !destination) {
            console.error('Telegram webhook: Invalid route_feature callback data', { callbackData, requestId, destination, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid routing data');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Routing...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Routing...</b>', 'HTML');
        }
        await handleFeatureRouting(botToken, callback_query, requestId, destination);
        return;
    }

    if (action === 'route_bug' && parts.length === 3) {
        const reportId = parsed.getString(1);
        const destination = parsed.getString(2);
        if (!reportId || !destination) {
            console.error('Telegram webhook: Invalid route_bug callback data', { callbackData, reportId, destination, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid routing data');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Routing...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Routing...</b>', 'HTML');
        }
        await handleBugRouting(botToken, callback_query, reportId, destination);
        return;
    }

    if (['approve', 'changes', 'reject'].includes(action) && parts.length === 2) {
        const issueNumber = parsed.getInt(1);
        if (!issueNumber) {
            console.error('Telegram webhook: Invalid design review callback data', { callbackData, action, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue number');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Processing...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Processing...</b>', 'HTML');
        }
        await handleDesignReviewAction(botToken, callback_query, action as ReviewAction, issueNumber);
        return;
    }

    if (action === 'clarified' && parts.length === 2) {
        const issueNumber = parsed.getInt(1);
        if (!issueNumber) {
            console.error('Telegram webhook: Invalid clarified callback data', { callbackData, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue number');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Updating status...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Updating status...</b>', 'HTML');
        }
        await handleClarificationReceived(botToken, callback_query, issueNumber);
        return;
    }

    if (action === 'merge' && parts.length === 3) {
        const issueNumber = parsed.getInt(1);
        const prNumber = parsed.getInt(2);
        if (!issueNumber || !prNumber) {
            console.error('Telegram webhook: Invalid merge callback data', { callbackData, issueNumber, prNumber, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue or PR number');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Merging PR...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Merging PR...</b>', 'HTML');
        }
        await handleMergeCallback(botToken, callback_query, issueNumber, prNumber);
        return;
    }

    if (action === 'merge_final' && parts.length === 3) {
        const issueNumber = parsed.getInt(1);
        const prNumber = parsed.getInt(2);
        if (!issueNumber || !prNumber) {
            console.error('Telegram webhook: Invalid merge_final callback data', { callbackData, issueNumber, prNumber, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue or PR number');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Merging final PR...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Merging final PR...</b>', 'HTML');
        }
        await handleMergeFinalPRCallback(botToken, callback_query, issueNumber, prNumber);
        return;
    }

    if (action === 'reqchanges' && parts.length === 3) {
        const issueNumber = parsed.getInt(1);
        const prNumber = parsed.getInt(2);
        if (!issueNumber || !prNumber) {
            console.error('Telegram webhook: Invalid reqchanges callback data', { callbackData, issueNumber, prNumber, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue or PR number');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Processing...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Processing...</b>', 'HTML');
        }
        await handleRequestChangesCallback(botToken, callback_query, issueNumber, prNumber);
        return;
    }

    if (action === 'design_approve' && parts.length === 4) {
        const prNumber = parsed.getInt(1);
        const issueNumber = parsed.getInt(2);
        const designType = parsed.getString(3).toLowerCase() as DesignType;
        if (!prNumber || !issueNumber || !['product-dev', 'product', 'tech'].includes(designType)) {
            console.error('Telegram webhook: Invalid design_approve callback data', { callbackData, prNumber, issueNumber, designType, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid callback data');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Merging design PR...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Merging design PR...</b>', 'HTML');
        }
        await handleDesignPRApproval(botToken, callback_query, prNumber, issueNumber, designType);
        return;
    }

    if (action === 'design_changes' && parts.length === 4) {
        const prNumber = parsed.getInt(1);
        const issueNumber = parsed.getInt(2);
        const designType = parsed.getString(3).toLowerCase() as DesignType;
        if (!prNumber || !issueNumber || !['product-dev', 'product', 'tech'].includes(designType)) {
            console.error('Telegram webhook: Invalid design_changes callback data', { callbackData, prNumber, issueNumber, designType, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid callback data');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Processing...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Processing...</b>', 'HTML');
        }
        await handleDesignPRRequestChanges(botToken, callback_query, prNumber, issueNumber, designType);
        return;
    }

    if (action === 'rv' && parts.length >= 5) {
        const issueNumber = parsed.getInt(1);
        const prNumber = parsed.getInt(2);
        const shortSha = parsed.getString(3);
        const prevStatus = parsed.getString(4);
        const phase = parts.length >= 6 ? parsed.getString(5) : '';
        if (!issueNumber || !prNumber || !shortSha || !prevStatus) {
            console.error('Telegram webhook: Invalid revert callback data', { callbackData, issueNumber, prNumber, shortSha, prevStatus, phase, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid revert data');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Creating revert PR...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Creating revert PR...</b>', 'HTML');
        }
        await handleRevertMerge(botToken, callback_query, issueNumber, prNumber, shortSha, prevStatus, phase);
        return;
    }

    if (action === 'merge_rv' && parts.length === 3) {
        const issueNumber = parsed.getInt(1);
        const revertPrNumber = parsed.getInt(2);
        if (!issueNumber || !revertPrNumber) {
            console.error('Telegram webhook: Invalid merge_rv callback data', { callbackData, issueNumber, revertPrNumber, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid merge data');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Merging revert PR...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Merging revert PR...</b>', 'HTML');
        }
        await handleMergeRevertPR(botToken, callback_query, issueNumber, revertPrNumber);
        return;
    }

    if (action === 'u_rc' && parts.length === 4) {
        const issueNumber = parsed.getInt(1);
        const prNumber = parsed.getInt(2);
        const timestamp = parsed.getInt(3);
        if (!issueNumber || !prNumber || !timestamp) {
            console.error('Telegram webhook: Invalid u_rc callback data', { callbackData, issueNumber, prNumber, timestamp, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid undo data');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Undoing...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Undoing...</b>', 'HTML');
        }
        await handleUndoRequestChanges(botToken, callback_query, issueNumber, prNumber, timestamp);
        return;
    }

    if (action === 'u_dc' && parts.length === 5) {
        const prNumber = parsed.getInt(1);
        const issueNumber = parsed.getInt(2);
        const designType = parsed.getString(3).toLowerCase() as DesignType;
        const timestamp = parsed.getInt(4);
        if (!prNumber || !issueNumber || !['product-dev', 'product', 'tech'].includes(designType) || !timestamp) {
            console.error('Telegram webhook: Invalid u_dc callback data', { callbackData, prNumber, issueNumber, designType, timestamp, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid undo data');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Undoing...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Undoing...</b>', 'HTML');
        }
        await handleUndoDesignChanges(botToken, callback_query, prNumber, issueNumber, designType, timestamp);
        return;
    }

    if (action === 'u_dr' && parts.length === 5) {
        const issueNumber = parsed.getInt(1);
        const originalAction = parsed.getString(2) as 'changes' | 'reject';
        const previousStatus = parsed.getString(3);
        const timestamp = parsed.getInt(4);
        if (!issueNumber || !['changes', 'reject'].includes(originalAction) || !previousStatus || !timestamp) {
            console.error('Telegram webhook: Invalid u_dr callback data', { callbackData, issueNumber, originalAction, previousStatus, timestamp, parts });
            await answerCallbackQuery(botToken, callback_query.id, 'Invalid undo data');
            return;
        }
        await answerCallbackQuery(botToken, callback_query.id, '⏳ Undoing...');
        if (callback_query.message) {
            await editMessageText(botToken, callback_query.message.chat.id, callback_query.message.message_id, escapeHtml(callback_query.message.text || '') + '\n\n⏳ <b>Undoing...</b>', 'HTML');
        }
        await handleUndoDesignReview(botToken, callback_query, issueNumber, originalAction, previousStatus, timestamp);
        return;
    }

    // Unknown action
    console.error('Telegram webhook: Unknown action received', {
        callbackData,
        action,
        parts,
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

    if (callback_query.message) {
        const originalText = callback_query.message.text || '';
        const errorMarkerPlainText = '⚠️ Unknown Action';

        if (originalText.includes(errorMarkerPlainText)) {
            return;
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
                callbackData,
            });
        }
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
    const callbackWithData = callback_query as typeof callback_query & { data: string };

    try {
        // Run the handler with a timeout to ensure we always respond to Telegram
        // within a reasonable time, preventing frozen loading states.
        const { timedOut } = await withTimeout(
            () => processCallbackQuery(botToken, callbackWithData, parsed),
            HANDLER_TIMEOUT_MS,
            parsed.action
        );

        if (timedOut) {
            console.warn(`[WEBHOOK:TIMEOUT] Action "${parsed.action}" timed out after ${HANDLER_TIMEOUT_MS}ms, returning response to Telegram`);
        }

        // Flush any pending S3 log writes before the response completes
        await flushPendingLogs();
        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        try {
            await answerCallbackQuery(
                botToken,
                callback_query.id,
                `❌ Error: ${errorMessage.slice(0, 150)}`
            );

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
        } catch (notifyError) {
            console.error('Telegram webhook: failed to notify user of error:', notifyError);
        }

        // Flush any pending S3 log writes even on error
        await flushPendingLogs();
        return res.status(200).json({ ok: true });
    }
}
