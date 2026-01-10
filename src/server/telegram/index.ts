import { users } from '@/server/database';

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
