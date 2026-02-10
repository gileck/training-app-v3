/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Type definitions for Telegram Webhook
 */

export interface TelegramCallbackQuery {
    id: string;
    from: {
        id: number;
        username?: string;
    };
    message?: {
        message_id: number;
        chat: {
            id: number;
        };
        text?: string;
    };
    data?: string;
}

export interface TelegramUpdate {
    update_id: number;
    callback_query?: TelegramCallbackQuery;
}

export type ReviewAction = 'approve' | 'changes' | 'reject';

export type DesignType = 'product-dev' | 'product' | 'tech';

export interface HandlerResult {
    success: boolean;
    error?: string;
}

export interface ParsedCallbackData {
    action: string;
    parts: string[];
    /**
     * Safely parse an integer from a callback data part
     * Returns null if the value is invalid, NaN, or missing
     */
    getInt: (index: number) => number | null;
    /**
     * Safely get a string from a callback data part
     * Returns empty string if missing
     */
    getString: (index: number) => string;
}
