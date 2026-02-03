/**
 * Telegram API helpers for Claude Bot
 */

import { BOT_CONFIG } from './config';
import { storeCallback } from './sessions';
import type { TelegramUpdate, TelegramResponse, InlineKeyboardButton } from './types';

// ============================================================
// MESSAGE FORMATTING
// ============================================================

/**
 * Convert Claude's markdown to Telegram HTML format.
 * HTML is more reliable than Markdown for Telegram (handles emojis, special chars).
 */
export function formatForTelegram(text: string): string {
    let formatted = text;

    // Escape HTML special characters first
    formatted = formatted.replace(/&/g, '&amp;');
    formatted = formatted.replace(/</g, '&lt;');
    formatted = formatted.replace(/>/g, '&gt;');

    // IMPORTANT: Process code blocks BEFORE inline code (triple backticks before single)
    // Convert ```code blocks``` to <pre>code</pre>
    formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
        // Trim trailing newline if present
        const trimmedCode = code.replace(/\n$/, '');
        return `<pre>${trimmedCode}</pre>`;
    });

    // Convert `code` to <code>code</code> (after code blocks to avoid interference)
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert **bold** or *bold* to <b>bold</b>
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<b>$1</b>');

    // Convert _italic_ or __italic__ to <i>italic</i>
    formatted = formatted.replace(/__([^_]+)__/g, '<i>$1</i>');
    formatted = formatted.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, '<i>$1</i>');

    // Convert ### headers to <b>bold</b> (Telegram doesn't support headers)
    formatted = formatted.replace(/^###?\s*(.+)$/gm, '<b>$1</b>');

    return formatted;
}

export function splitMessage(text: string): string[] {
    const maxLength = BOT_CONFIG.maxMessageLength;

    if (text.length <= maxLength) {
        return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }

        // Find a good breaking point
        let breakPoint = remaining.lastIndexOf('\n', maxLength);
        if (breakPoint === -1 || breakPoint < maxLength / 2) {
            breakPoint = remaining.lastIndexOf(' ', maxLength);
        }
        if (breakPoint === -1 || breakPoint < maxLength / 2) {
            breakPoint = maxLength;
        }

        chunks.push(remaining.slice(0, breakPoint));
        remaining = remaining.slice(breakPoint).trim();
    }

    return chunks;
}

// ============================================================
// TELEGRAM API FUNCTIONS
// ============================================================

export async function sendMessage(
    botToken: string,
    chatId: string,
    text: string,
    threadId?: number,
    replyToMessageId?: number,
    buttons?: Array<{ label: string; callback: string }>
): Promise<number | undefined> {
    // Split raw text FIRST, then format each chunk independently
    // This prevents HTML tags from being broken across chunks
    const rawChunks = splitMessage(text);
    const chunks = rawChunks.map(chunk => formatForTelegram(chunk));
    let firstMessageId: number | undefined;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const isLastChunk = i === chunks.length - 1;

        const body: Record<string, unknown> = {
            chat_id: chatId,
            text: chunk,
            parse_mode: 'HTML',
        };

        if (threadId) {
            body.message_thread_id = threadId;
        }

        if (replyToMessageId && i === 0) {
            body.reply_to_message_id = replyToMessageId;
        }

        // Add inline keyboard only to last chunk
        if (isLastChunk && buttons && buttons.length > 0) {
            const keyboard: InlineKeyboardButton[][] = [];
            for (let j = 0; j < buttons.length; j += 2) {
                const row: InlineKeyboardButton[] = [];
                const callbackId1 = storeCallback(buttons[j].callback);
                row.push({ text: buttons[j].label, callback_data: callbackId1 });
                if (buttons[j + 1]) {
                    const callbackId2 = storeCallback(buttons[j + 1].callback);
                    row.push({ text: buttons[j + 1].label, callback_data: callbackId2 });
                }
                keyboard.push(row);
            }
            body.reply_markup = { inline_keyboard: keyboard };
        }

        try {
            const response = await fetch(`${BOT_CONFIG.telegramApiUrl}${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                // HTML parsing failed - retry without formatting and strip HTML tags
                console.log('⚠️ HTML parsing failed, retrying without formatting...');
                body.parse_mode = undefined;
                // Strip HTML tags so they don't show literally
                body.text = (body.text as string)
                    .replace(/<b>/g, '').replace(/<\/b>/g, '')
                    .replace(/<i>/g, '').replace(/<\/i>/g, '')
                    .replace(/<code>/g, '').replace(/<\/code>/g, '')
                    .replace(/<pre>/g, '').replace(/<\/pre>/g, '');
                const retryResponse = await fetch(`${BOT_CONFIG.telegramApiUrl}${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const retryData = await retryResponse.json() as { ok: boolean; result?: { message_id: number } };
                if (retryData.ok && retryData.result && !firstMessageId) {
                    firstMessageId = retryData.result.message_id;
                }
            } else {
                const data = await response.json() as { ok: boolean; result?: { message_id: number } };
                if (data.ok && data.result && !firstMessageId) {
                    firstMessageId = data.result.message_id;
                }
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    return firstMessageId;
}

export async function answerCallbackQuery(
    botToken: string,
    callbackQueryId: string,
    text?: string
): Promise<void> {
    try {
        await fetch(`${BOT_CONFIG.telegramApiUrl}${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: text || undefined
            })
        });
    } catch {
        // Ignore errors
    }
}

export async function deleteMessage(
    botToken: string,
    chatId: string,
    messageId: number
): Promise<void> {
    try {
        await fetch(`${BOT_CONFIG.telegramApiUrl}${botToken}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId
            })
        });
    } catch {
        // Ignore delete errors
    }
}

export async function sendTypingAction(botToken: string, chatId: string): Promise<void> {
    try {
        await fetch(`${BOT_CONFIG.telegramApiUrl}${botToken}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                action: 'typing'
            })
        });
    } catch {
        // Ignore typing action errors
    }
}

export async function deleteWebhook(botToken: string): Promise<boolean> {
    try {
        const response = await fetch(`${BOT_CONFIG.telegramApiUrl}${botToken}/deleteWebhook`, {
            method: 'POST'
        });
        const data = await response.json() as { ok: boolean; description?: string };
        if (data.ok) {
            console.log('✅ Webhook deleted successfully');
            return true;
        } else {
            console.error('❌ Failed to delete webhook:', data.description);
            return false;
        }
    } catch (error) {
        console.error('❌ Error deleting webhook:', error);
        return false;
    }
}

// Track connection state for "connection is back" message
let wasOffline = false;

export async function getUpdates(botToken: string, offset?: number): Promise<TelegramUpdate[]> {
    // Use shorter timeouts when offline to recover faster
    const telegramTimeout = wasOffline ? 5 : 30;  // Server-side timeout
    const clientTimeout = wasOffline ? 10000 : 35000;  // Client-side timeout (ms)

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), clientTimeout);

    try {
        const params = new URLSearchParams({
            timeout: String(telegramTimeout),
            allowed_updates: JSON.stringify(['message', 'callback_query'])
        });

        if (offset !== undefined) {
            params.set('offset', String(offset));
        }

        const response = await fetch(`${BOT_CONFIG.telegramApiUrl}${botToken}/getUpdates?${params}`, {
            signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await response.json() as TelegramResponse;

        if (data.ok) {
            // Connection restored after being offline
            if (wasOffline) {
                console.log('✅ Connection restored!');
                wasOffline = false;
            }
            return data.result;
        } else {
            console.error('❌ getUpdates failed:', JSON.stringify(data));
        }
    } catch (error) {
        clearTimeout(timeout);

        // Check for abort (client-side timeout)
        if ((error as Error).name === 'AbortError') {
            if (!wasOffline) {
                console.log('⚠️ Connection timeout, retrying...');
                wasOffline = true;
            }
            return [];
        }

        // Check for network errors
        const cause = (error as { cause?: { code?: string } })?.cause;
        if (cause?.code === 'ENOTFOUND' || cause?.code === 'ENETUNREACH' || cause?.code === 'ECONNREFUSED') {
            if (!wasOffline) {
                console.log('⚠️ No internet connection, retrying...');
                wasOffline = true;
            }
        } else {
            console.error('❌ Error getting updates:', (error as Error).message || error);
        }
    }

    return [];
}
