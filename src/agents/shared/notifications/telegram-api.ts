/**
 * Low-level Telegram API communication.
 *
 * Handles sending messages to the admin (actionable) and info channels,
 * with retry logic and topic-based supergroup support.
 */

import { agentConfig } from '../config';
import { appConfig } from '../../../app.config';
import type { SendResult, InlineKeyboardMarkup } from './types';
import { sleep } from './helpers';

// ============================================================
// TELEGRAM API
// ============================================================

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Parse a chat ID string that may include a topic thread ID.
 * Format: "chatId" or "chatId:threadId"
 */
function parseChatId(chatIdString: string): { chatId: string; threadId?: number } {
    const lastColonIndex = chatIdString.lastIndexOf(':');

    if (lastColonIndex <= 0) {
        return { chatId: chatIdString };
    }

    const potentialThreadId = chatIdString.slice(lastColonIndex + 1);

    if (/^\d+$/.test(potentialThreadId)) {
        return {
            chatId: chatIdString.slice(0, lastColonIndex),
            threadId: parseInt(potentialThreadId, 10)
        };
    }

    return { chatId: chatIdString };
}

/**
 * Get the actionable channel chat ID for agent workflow notifications.
 * Uses AGENT_TELEGRAM_CHAT_ID env var, falls back to ownerTelegramChatId.
 */
function getActionableChatId(): { chatId: string; threadId?: number } | null {
    const rawChatId = process.env.AGENT_TELEGRAM_CHAT_ID || appConfig.ownerTelegramChatId;
    if (!rawChatId) return null;
    return parseChatId(rawChatId);
}

/**
 * Get the info channel chat ID for non-actionable updates.
 * Uses AGENT_INFO_TELEGRAM_CHAT_ID env var, falls back to actionable channel.
 */
function getInfoChatId(): { chatId: string; threadId?: number } | null {
    const rawChatId = process.env.AGENT_INFO_TELEGRAM_CHAT_ID;
    if (!rawChatId) return getActionableChatId(); // Fallback to actionable channel
    return parseChatId(rawChatId);
}

/**
 * Send a Telegram message to the admin/owner
 * Retries up to 3 times with 3 second delays on failure
 */
export async function sendToAdmin(
    message: string,
    replyMarkup?: InlineKeyboardMarkup
): Promise<SendResult> {
    if (!agentConfig.telegram.enabled) {
        return { success: true }; // Silently skip if disabled
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.warn('  Telegram notification skipped: missing TELEGRAM_BOT_TOKEN');
        return { success: false, error: 'Missing bot token' };
    }

    const parsedChatId = getActionableChatId();
    if (!parsedChatId) {
        console.warn('  Telegram notification skipped: AGENT_TELEGRAM_CHAT_ID not configured');
        return { success: false, error: 'Actionable chat ID not configured' };
    }

    const { chatId, threadId } = parsedChatId;

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000; // 3 seconds

    // Log which chat ID is being used (helpful for debugging)
    const chatIdDisplay = threadId ? `${chatId}:${threadId}` : chatId;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const body: Record<string, unknown> = {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            };

            // Add thread ID for topic-based supergroups
            if (threadId) {
                body.message_thread_id = threadId;
            }

            if (replyMarkup) {
                body.reply_markup = replyMarkup;
            }

            const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Telegram API error: ${error}`);
            }

            console.log('  Telegram notification sent');
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`  Telegram notification attempt ${attempt}/${MAX_RETRIES} failed (chat_id: ${chatIdDisplay}):`, errorMessage);

            if (attempt < MAX_RETRIES) {
                console.log(`  Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
                await sleep(RETRY_DELAY_MS);
            } else {
                console.error(`  All retry attempts exhausted. Telegram notification not sent. (chat_id: ${chatIdDisplay})`);
                return { success: false, error: errorMessage };
            }
        }
    }

    // This should never be reached, but TypeScript requires it
    return { success: false, error: 'Max retries reached' };
}

/**
 * Send a Telegram message to the info channel (non-actionable updates)
 * Falls back to admin channel if info channel is not configured
 */
export async function sendToInfoChannel(
    message: string,
    replyMarkup?: InlineKeyboardMarkup
): Promise<SendResult> {
    if (!agentConfig.telegram.enabled) {
        return { success: true };
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.warn('  Telegram notification skipped: missing TELEGRAM_BOT_TOKEN');
        return { success: false, error: 'Missing bot token' };
    }

    const parsedChatId = getInfoChatId();
    if (!parsedChatId) {
        console.warn('  Telegram notification skipped: no chat ID configured');
        return { success: false, error: 'Chat ID not configured' };
    }

    const { chatId, threadId } = parsedChatId;

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 3000;

    const chatIdDisplay = threadId ? `${chatId}:${threadId}` : chatId;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const body: Record<string, unknown> = {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            };

            if (threadId) {
                body.message_thread_id = threadId;
            }

            if (replyMarkup) {
                body.reply_markup = replyMarkup;
            }

            const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Telegram API error: ${error}`);
            }

            console.log('  Telegram info notification sent');
            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`  Telegram info notification attempt ${attempt}/${MAX_RETRIES} failed (chat_id: ${chatIdDisplay}):`, errorMessage);

            if (attempt < MAX_RETRIES) {
                console.log(`  Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
                await sleep(RETRY_DELAY_MS);
            } else {
                console.error(`  All retry attempts exhausted. Telegram info notification not sent. (chat_id: ${chatIdDisplay})`);
                return { success: false, error: errorMessage };
            }
        }
    }

    return { success: false, error: 'Max retries reached' };
}
