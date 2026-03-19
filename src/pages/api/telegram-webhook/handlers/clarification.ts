/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handler for clarification received action
 *
 * Delegates business logic to workflow-service/clarification.
 * This handler only manages Telegram message editing.
 */

import {
    logExternalError,
    logExists,
} from '@/agents/lib/logging';
import { markClarificationReceived } from '@/server/template/workflow-service';
import { editMessageText } from '../telegram-api';
import { escapeHtml } from '../utils';
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
        const result = await markClarificationReceived(issueNumber);

        if (!result.success) {
            return { success: false, error: result.error };
        }

        // Edit message to show action taken
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

        console.log(`Telegram webhook: clarification received for issue #${issueNumber}`);
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
