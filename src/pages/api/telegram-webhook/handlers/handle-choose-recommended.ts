/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handle "Choose Recommended" callback from Telegram.
 *
 * Submits the recommended decision option for an issue
 * without requiring the admin to open the web UI.
 */

import type { TelegramCallbackQuery } from '../types';
import { editMessageWithResult } from '../telegram-api';
import { generateDecisionToken } from '@/apis/template/agent-decision/utils';
import { submitDecision } from '@/apis/template/agent-decision/handlers/submitDecision';

export async function handleChooseRecommended(
    botToken: string,
    callback_query: TelegramCallbackQuery,
    issueNumber: number,
): Promise<void> {
    const token = generateDecisionToken(issueNumber);

    const result = await submitDecision({
        issueNumber,
        token,
        selection: { chooseRecommended: true },
    });

    if (!callback_query.message) return;

    const { chat, message_id, text } = callback_query.message;

    if (result.success) {
        const detail = result.routedTo ? ` → ${result.routedTo}` : '';
        await editMessageWithResult(
            botToken, chat.id, message_id, text || '',
            true, `Recommended option selected${detail}`,
        );
    } else {
        await editMessageWithResult(
            botToken, chat.id, message_id, text || '',
            false, result.error || 'Unknown error',
        );
    }
}
