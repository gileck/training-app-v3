/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Telegram Bot API helper functions
 */

import { TELEGRAM_API_URL } from './constants';
import { escapeHtml, formatUndoTimeRemaining } from './utils';

/**
 * Answer a callback query (acknowledge button click)
 */
export async function answerCallbackQuery(
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
export async function editMessageWithResult(
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
export async function editMessageText(
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
export async function editMessageWithUndoButton(
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
 * Helper to edit message with routing action result
 */
export async function editMessageWithRouting(
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
