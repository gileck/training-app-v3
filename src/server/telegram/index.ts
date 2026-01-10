/**
 * Telegram Notifications Module
 *
 * This module provides TWO DISTINCT notification channels:
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ 1. OWNER NOTIFICATIONS (App-Level)                                      │
 * │    - Recipient: App owner/administrator                                 │
 * │    - Config: ownerTelegramChatId in app.config.js                       │
 * │    - Use for: New signups, errors, API thresholds, system alerts        │
 * │    - Function: sendNotificationToOwner()                                │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │ 2. USER NOTIFICATIONS (Per-User)                                        │
 * │    - Recipient: Individual logged-in users                              │
 * │    - Config: telegramChatId in user's profile (database)                │
 * │    - Use for: Personal alerts, task updates, user-specific events       │
 * │    - Function: sendTelegramNotificationToUser()                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Setup:
 * - Run `yarn telegram-setup` to get your chat ID
 * - For owner: Add OWNER_TELEGRAM_CHAT_ID to .env
 * - For users: They add their chat ID in their Profile settings
 */

import { users } from '@/server/database';
import { appConfig } from '@/app.config';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

export interface SendMessageOptions {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableNotification?: boolean;
}

export interface SendMessageResult {
    success: boolean;
    error?: string;
}

/**
 * Send a Telegram notification to a specific chat ID
 */
async function sendToChat(
    chatId: string,
    message: string,
    options?: SendMessageOptions
): Promise<SendMessageResult> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        console.warn('Telegram notification skipped: missing TELEGRAM_BOT_TOKEN');
        return { success: false, error: 'Missing bot token' };
    }

    try {
        const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: options?.parseMode,
                disable_notification: options?.disableNotification
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Telegram API error:', error);
            return { success: false, error };
        }

        return { success: true };
    } catch (error) {
        console.error('Failed to send Telegram notification:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Send a Telegram notification to a user by their user ID.
 * Looks up the user's telegramChatId from the database.
 */
export async function sendTelegramNotificationToUser(
    userId: string,
    message: string,
    options?: SendMessageOptions
): Promise<SendMessageResult> {
    try {
        const user = await users.findUserById(userId);

        if (!user?.telegramChatId) {
            return { success: false, error: 'User has no Telegram chat ID configured' };
        }

        return sendToChat(user.telegramChatId, message, options);
    } catch (error) {
        console.error('Failed to send Telegram notification to user:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Send a Telegram notification to a specific chat ID directly.
 */
export async function sendTelegramNotification(
    chatId: string,
    message: string,
    options?: SendMessageOptions
): Promise<SendMessageResult> {
    if (!chatId) {
        console.warn('Telegram notification skipped: no chat ID provided');
        return { success: false, error: 'Missing chat ID' };
    }

    return sendToChat(chatId, message, options);
}

// ============================================================================
// OWNER NOTIFICATIONS
// ============================================================================

/**
 * Send a Telegram notification to the app OWNER.
 *
 * This is for APP-LEVEL events, NOT user-specific notifications:
 * - New user signups
 * - System errors and exceptions
 * - API usage thresholds
 * - Security alerts
 * - Deployment notifications
 *
 * The owner's chat ID is configured in app.config.js (ownerTelegramChatId)
 * or via OWNER_TELEGRAM_CHAT_ID environment variable.
 *
 * @example
 * // Notify owner of new signup
 * await sendNotificationToOwner(`New user signed up: ${user.email}`);
 *
 * // Notify owner of error
 * await sendNotificationToOwner(`API Error: ${error.message}`, { parseMode: 'HTML' });
 */
export async function sendNotificationToOwner(
    message: string,
    options?: SendMessageOptions
): Promise<SendMessageResult> {
    const ownerChatId = appConfig.ownerTelegramChatId;

    if (!ownerChatId) {
        console.warn('Owner notification skipped: ownerTelegramChatId not configured');
        return { success: false, error: 'Owner chat ID not configured' };
    }

    return sendToChat(ownerChatId, message, options);
}
