/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for design review actions (approve/changes/reject)
 */

import { getProjectManagementAdapter } from '@/server/project-management';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExists,
} from '@/agents/lib/logging';
import { editMessageText, editMessageWithUndoButton } from '../telegram-api';
import { escapeHtml, findItemByIssueNumber } from '../utils';
import {
    STATUS_TRANSITIONS,
    ACTION_TO_REVIEW_STATUS,
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
    const reviewStatus = ACTION_TO_REVIEW_STATUS[action];

    // Initialize the adapter
    const adapter = getProjectManagementAdapter();
    await adapter.init();

    // Find the project item by issue number
    const item = await findItemByIssueNumber(adapter, issueNumber);

    if (!item) {
        console.warn(`[LOG:DESIGN_REVIEW] Issue #${issueNumber} not found in project`);
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    // Validate item is in a design phase that can be reviewed
    // This prevents stale Telegram buttons from causing wrong state transitions
    const designPhases = [
        'Product Development',
        'Product Design',
        'Bug Investigation',
        'Technical Design',
    ];
    if (item.status && !designPhases.includes(item.status)) {
        console.warn(`[LOG:DESIGN_REVIEW] Issue #${issueNumber} is no longer in a design phase (current status: ${item.status}). Action ignored.`);
        if (callbackQuery.message) {
            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                `${escapeHtml(callbackQuery.message.text || '')}\n\n⚠️ <b>Action no longer valid</b>\nThis item has moved to "${escapeHtml(item.status)}" and can no longer be reviewed from this message.`,
                'HTML'
            );
        }
        return { success: false, error: `Item is no longer in a reviewable design phase (current status: ${item.status})` };
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
