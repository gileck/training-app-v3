/**
 * Type definitions for Telegram Claude Bot
 */

// ============================================================
// SESSION TYPES
// ============================================================

export interface ChatSession {
    sessionId: string | null;
    summary: string | null;
    messageCount: number;
}

// ============================================================
// TELEGRAM TYPES
// ============================================================

export interface TelegramUpdate {
    update_id: number;
    message?: {
        message_id: number;
        from: {
            id: number;
            first_name: string;
            username?: string;
        };
        chat: {
            id: number;
            type: string;
        };
        date: number;
        text?: string;
        message_thread_id?: number;
    };
    callback_query?: {
        id: string;
        from: {
            id: number;
            first_name: string;
            username?: string;
        };
        message?: {
            message_id: number;
            chat: {
                id: number;
                type: string;
            };
            message_thread_id?: number;
        };
        data?: string;
    };
}

export interface TelegramResponse {
    ok: boolean;
    result: TelegramUpdate[];
}

export interface InlineKeyboardButton {
    text: string;
    callback_data: string;
}

export interface InlineKeyboardMarkup {
    inline_keyboard: InlineKeyboardButton[][];
}

// ============================================================
// CLAUDE TYPES
// ============================================================

export interface ClaudeStructuredResponse {
    text: string;
    buttons?: Array<{
        label: string;
        callback: string;
    }>;
}

export interface ProcessResult {
    text: string;
    buttons?: Array<{ label: string; callback: string }>;
}
