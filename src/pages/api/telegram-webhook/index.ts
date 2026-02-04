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
import { answerCallbackQuery, editMessageText, editMessageWithResult } from './telegram-api';
import { parseCallbackData, escapeHtml } from './utils';
import {
    handleFeatureRequestApproval,
    handleBugReportApproval,
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
            const requestId = parsed.getString(1);
            if (!requestId) {
                console.error('Telegram webhook: Invalid approve_request callback data', { callbackData, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid request ID');
                return res.status(200).json({ ok: true });
            }
            const result = await handleFeatureRequestApproval(botToken, callback_query, requestId);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Approved!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
                if (callback_query.message) {
                    await editMessageWithResult(botToken, callback_query.message.chat.id, callback_query.message.message_id, callback_query.message.text || '', false, result.error || 'Unknown error');
                }
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'approve_bug' && parts.length === 2) {
            const reportId = parsed.getString(1);
            if (!reportId) {
                console.error('Telegram webhook: Invalid approve_bug callback data', { callbackData, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid report ID');
                return res.status(200).json({ ok: true });
            }
            const result = await handleBugReportApproval(botToken, callback_query, reportId);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Approved!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
                if (callback_query.message) {
                    await editMessageWithResult(botToken, callback_query.message.chat.id, callback_query.message.message_id, callback_query.message.text || '', false, result.error || 'Unknown error');
                }
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'route_feature' && parts.length === 3) {
            const requestId = parsed.getString(1);
            const destination = parsed.getString(2);
            if (!requestId || !destination) {
                console.error('Telegram webhook: Invalid route_feature callback data', { callbackData, requestId, destination, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid routing data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleFeatureRouting(botToken, callback_query, requestId, destination);
            if (!result.success) {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'route_bug' && parts.length === 3) {
            const reportId = parsed.getString(1);
            const destination = parsed.getString(2);
            if (!reportId || !destination) {
                console.error('Telegram webhook: Invalid route_bug callback data', { callbackData, reportId, destination, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid routing data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleBugRouting(botToken, callback_query, reportId, destination);
            if (!result.success) {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (['approve', 'changes', 'reject'].includes(action) && parts.length === 2) {
            const issueNumber = parsed.getInt(1);
            if (!issueNumber) {
                console.error('Telegram webhook: Invalid design review callback data', { callbackData, action, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue number');
                return res.status(200).json({ ok: true });
            }
            const result = await handleDesignReviewAction(botToken, callback_query, action as ReviewAction, issueNumber);
            if (!result.success) {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'clarified' && parts.length === 2) {
            const issueNumber = parsed.getInt(1);
            if (!issueNumber) {
                console.error('Telegram webhook: Invalid clarified callback data', { callbackData, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue number');
                return res.status(200).json({ ok: true });
            }
            const result = await handleClarificationReceived(botToken, callback_query, issueNumber);
            if (!result.success) {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'merge' && parts.length === 3) {
            const issueNumber = parsed.getInt(1);
            const prNumber = parsed.getInt(2);
            if (!issueNumber || !prNumber) {
                console.error('Telegram webhook: Invalid merge callback data', { callbackData, issueNumber, prNumber, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue or PR number');
                return res.status(200).json({ ok: true });
            }
            const result = await handleMergeCallback(botToken, callback_query, issueNumber, prNumber);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Merged!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'merge_final' && parts.length === 3) {
            const issueNumber = parsed.getInt(1);
            const prNumber = parsed.getInt(2);
            if (!issueNumber || !prNumber) {
                console.error('Telegram webhook: Invalid merge_final callback data', { callbackData, issueNumber, prNumber, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue or PR number');
                return res.status(200).json({ ok: true });
            }
            const result = await handleMergeFinalPRCallback(botToken, callback_query, issueNumber, prNumber);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Final PR Merged!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'reqchanges' && parts.length === 3) {
            const issueNumber = parsed.getInt(1);
            const prNumber = parsed.getInt(2);
            if (!issueNumber || !prNumber) {
                console.error('Telegram webhook: Invalid reqchanges callback data', { callbackData, issueNumber, prNumber, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid issue or PR number');
                return res.status(200).json({ ok: true });
            }
            const result = await handleRequestChangesCallback(botToken, callback_query, issueNumber, prNumber);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '🔄 Marked for changes');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'design_approve' && parts.length === 4) {
            const prNumber = parsed.getInt(1);
            const issueNumber = parsed.getInt(2);
            const designType = parsed.getString(3).toLowerCase() as DesignType;
            if (!prNumber || !issueNumber || !['product-dev', 'product', 'tech'].includes(designType)) {
                console.error('Telegram webhook: Invalid design_approve callback data', { callbackData, prNumber, issueNumber, designType, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid callback data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleDesignPRApproval(botToken, callback_query, prNumber, issueNumber, designType);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Merged!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'design_changes' && parts.length === 4) {
            const prNumber = parsed.getInt(1);
            const issueNumber = parsed.getInt(2);
            const designType = parsed.getString(3).toLowerCase() as DesignType;
            if (!prNumber || !issueNumber || !['product-dev', 'product', 'tech'].includes(designType)) {
                console.error('Telegram webhook: Invalid design_changes callback data', { callbackData, prNumber, issueNumber, designType, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid callback data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleDesignPRRequestChanges(botToken, callback_query, prNumber, issueNumber, designType);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '🔄 Changes requested');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
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
                return res.status(200).json({ ok: true });
            }
            const result = await handleRevertMerge(botToken, callback_query, issueNumber, prNumber, shortSha, prevStatus, phase);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '↩️ Revert PR created!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'merge_rv' && parts.length === 3) {
            const issueNumber = parsed.getInt(1);
            const revertPrNumber = parsed.getInt(2);
            if (!issueNumber || !revertPrNumber) {
                console.error('Telegram webhook: Invalid merge_rv callback data', { callbackData, issueNumber, revertPrNumber, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid merge data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleMergeRevertPR(botToken, callback_query, issueNumber, revertPrNumber);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '✅ Revert PR merged!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'u_rc' && parts.length === 4) {
            const issueNumber = parsed.getInt(1);
            const prNumber = parsed.getInt(2);
            const timestamp = parsed.getInt(3);
            if (!issueNumber || !prNumber || !timestamp) {
                console.error('Telegram webhook: Invalid u_rc callback data', { callbackData, issueNumber, prNumber, timestamp, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid undo data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleUndoRequestChanges(botToken, callback_query, issueNumber, prNumber, timestamp);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '↩️ Undone!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'u_dc' && parts.length === 5) {
            const prNumber = parsed.getInt(1);
            const issueNumber = parsed.getInt(2);
            const designType = parsed.getString(3).toLowerCase() as DesignType;
            const timestamp = parsed.getInt(4);
            if (!prNumber || !issueNumber || !['product-dev', 'product', 'tech'].includes(designType) || !timestamp) {
                console.error('Telegram webhook: Invalid u_dc callback data', { callbackData, prNumber, issueNumber, designType, timestamp, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid undo data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleUndoDesignChanges(botToken, callback_query, prNumber, issueNumber, designType, timestamp);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '↩️ Undone!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
        }

        if (action === 'u_dr' && parts.length === 5) {
            const issueNumber = parsed.getInt(1);
            const originalAction = parsed.getString(2) as 'changes' | 'reject';
            const previousStatus = parsed.getString(3);
            const timestamp = parsed.getInt(4);
            if (!issueNumber || !['changes', 'reject'].includes(originalAction) || !previousStatus || !timestamp) {
                console.error('Telegram webhook: Invalid u_dr callback data', { callbackData, issueNumber, originalAction, previousStatus, timestamp, parts });
                await answerCallbackQuery(botToken, callback_query.id, 'Invalid undo data');
                return res.status(200).json({ ok: true });
            }
            const result = await handleUndoDesignReview(botToken, callback_query, issueNumber, originalAction, previousStatus, timestamp);
            if (result.success) {
                await answerCallbackQuery(botToken, callback_query.id, '↩️ Undone!');
            } else {
                await answerCallbackQuery(botToken, callback_query.id, `❌ ${result.error?.slice(0, 150)}`);
            }
            return res.status(200).json({ ok: true });
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
                    callbackData,
                });
            }
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Telegram webhook error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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

        return res.status(200).json({ ok: true });
    }
}
