/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handler for clarification received action
 */

import { getProjectManagementAdapter } from '@/server/project-management';
import { REVIEW_STATUSES } from '@/server/project-management/config';
import {
    logWebhookAction,
    logExternalError,
    logExists,
} from '@/agents/lib/logging';
import { editMessageText } from '../telegram-api';
import { escapeHtml, findItemByIssueNumber } from '../utils';
import type { TelegramCallbackQuery, HandlerResult } from '../types';

/**
 * Handle "Clarification Received" button click
 * Callback format: "clarified:issueNumber"
 */
export async function handleClarificationReceived(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number
): Promise<HandlerResult> {
    try {
        // 1. Initialize adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // 2. Find project item by issue number
        const item = await findItemByIssueNumber(adapter, issueNumber);

        if (!item) {
            console.warn(`[LOG:CLARIFICATION] Item not found in GitHub Projects: issue #${issueNumber}`);
            return { success: false, error: 'Item not found in GitHub Projects' };
        }

        // 3. Verify current status
        if (item.reviewStatus !== REVIEW_STATUSES.waitingForClarification) {
            console.warn(`[LOG:CLARIFICATION] Issue #${issueNumber} not waiting for clarification (current: ${item.reviewStatus || 'none'})`);
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

        // 5. Edit message to show action taken
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
        console.error(`[LOG:CLARIFICATION] Error handling clarification for issue #${issueNumber}:`, error);
        if (logExists(issueNumber)) {
            logExternalError(issueNumber, 'telegram', error instanceof Error ? error : new Error(String(error)));
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
