/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for design review actions (approve/changes/reject)
 *
 * Delegates business logic to workflow-service/design-review.
 * This handler only manages Telegram message editing.
 */

import {
    logExternalError,
    logExists,
} from '@/agents/lib/logging';
import { reviewDesign } from '@/server/workflow-service';
import { editMessageText, editMessageWithUndoButton } from '../telegram-api';
import { escapeHtml } from '../utils';
import {
    ACTION_LABELS,
    ACTION_EMOJIS,
} from '../constants';
import type { TelegramCallbackQuery, ReviewAction, HandlerResult } from '../types';

/**
 * Handle design review actions (approve/changes/reject)
 * Callback format: "approve:123", "changes:123", "reject:123"
 */
export async function handleDesignReviewAction(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    action: ReviewAction,
    issueNumber: number
): Promise<HandlerResult> {
    try {
    const result = await reviewDesign(issueNumber, action);

    if (!result.success) {
        // If item is no longer in a reviewable phase, update the Telegram message
        if (result.error?.includes('no longer in a reviewable design phase') && callbackQuery.message) {
            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                `${escapeHtml(callbackQuery.message.text || '')}\n\n⚠️ <b>Action no longer valid</b>\nThis item has moved and can no longer be reviewed from this message.`,
                'HTML'
            );
        }
        return { success: false, error: result.error };
    }

    // Build detailed status message for the edited message
    let statusDetails = '';
    const timestamp = Date.now();
    const previousStatus = result.previousStatus || '';

    if (action === 'approve') {
        if (result.advancedTo) {
            statusDetails = `\n\n✅ <b>Success!</b>\n📊 Status: ${result.advancedTo}\n📋 Review Status: (ready for agent)`;
        } else {
            statusDetails = `\n\n✅ <b>Success!</b>\n📊 Status: ${previousStatus}\n📋 Review Status: ${result.reviewStatus}\n\n💡 Merge the PR to complete.`;
        }
    } else if (action === 'changes') {
        statusDetails = `\n\n📝 <b>Changes Requested</b>\n📊 Status: ${previousStatus}\n📋 Review Status: ${result.reviewStatus}\n\n💡 Add comments on the issue, then run agents.\n\n<i>Changed your mind? Click Undo within 5 minutes.</i>`;
    } else if (action === 'reject') {
        statusDetails = `\n\n❌ <b>Rejected</b>\n📊 Status: ${previousStatus}\n📋 Review Status: ${result.reviewStatus}\n\n<i>Changed your mind? Click Undo within 5 minutes.</i>`;
    }

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

    console.log(`Telegram webhook: ${action} issue #${issueNumber}`);
    return { success: true };
    } catch (error) {
        console.error(`[LOG:DESIGN_REVIEW] Error handling ${action} for issue #${issueNumber}:`, error);
        if (logExists(issueNumber)) {
            logExternalError(issueNumber, 'telegram', error instanceof Error ? error : new Error(String(error)));
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
