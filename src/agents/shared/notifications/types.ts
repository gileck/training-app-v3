/**
 * Shared types for Telegram notifications.
 */

export interface SendResult {
    success: boolean;
    error?: string;
}

/**
 * Inline keyboard button for Telegram
 * Supports both callback buttons and URL buttons
 */
export interface InlineButton {
    text: string;
    callback_data?: string;
    url?: string;
}

/**
 * Inline keyboard markup for Telegram
 */
export interface InlineKeyboardMarkup {
    inline_keyboard: InlineButton[][];
}
