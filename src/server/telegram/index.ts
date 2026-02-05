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
 * - For owner: Set ownerTelegramChatId in app.config.js
 * - For users: They add their chat ID in their Profile settings
 */

import { users } from '@/server/database';
import type { FeatureRequestDocument } from '@/server/database/collections/template/feature-requests/types';
import type { ReportDocument } from '@/server/database/collections/template/reports/types';
import { appConfig } from '@/app.config';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

export interface InlineKeyboardButton {
    text: string;
    url?: string;
    callback_data?: string;
}

export interface SendMessageOptions {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableNotification?: boolean;
    inlineKeyboard?: InlineKeyboardButton[][];
}

export interface SendMessageResult {
    success: boolean;
    error?: string;
}

/**
 * Parse a chat ID string that may include a topic thread ID.
 *
 * Supports two formats:
 * - Simple: "-100123456789" (just chat ID)
 * - With topic: "-100123456789:42" (chat ID + thread ID for topics)
 *
 * @example
 * parseChatId("-100123456789") // { chatId: "-100123456789", threadId: undefined }
 * parseChatId("-100123456789:42") // { chatId: "-100123456789", threadId: "42" }
 */
function parseChatId(chatIdString: string): { chatId: string; threadId?: string } {
    const lastColonIndex = chatIdString.lastIndexOf(':');

    // No colon found, or colon is at the start (invalid)
    if (lastColonIndex <= 0) {
        return { chatId: chatIdString };
    }

    const potentialThreadId = chatIdString.slice(lastColonIndex + 1);

    // Check if the part after the last colon is a valid number (thread ID)
    if (/^\d+$/.test(potentialThreadId)) {
        return {
            chatId: chatIdString.slice(0, lastColonIndex),
            threadId: potentialThreadId
        };
    }

    // Not a valid thread ID, treat the whole string as chat ID
    return { chatId: chatIdString };
}

/**
 * Send a Telegram notification to a specific chat ID.
 *
 * Supports topic threads via combined format: "chatId:threadId"
 * @example
 * sendToChat("-100123456789", "Hello")           // Send to chat
 * sendToChat("-100123456789:42", "Hello")        // Send to topic thread 42
 */
async function sendToChat(
    chatIdString: string,
    message: string,
    options?: SendMessageOptions
): Promise<SendMessageResult> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
        console.warn('[Telegram] Notification skipped: missing TELEGRAM_BOT_TOKEN');
        return { success: false, error: 'Missing bot token' };
    }

    // Parse chat ID and optional thread ID (for topics)
    const { chatId, threadId } = parseChatId(chatIdString);

    try {
        const body: Record<string, unknown> = {
            chat_id: chatId,
            text: message,
            parse_mode: options?.parseMode,
            disable_notification: options?.disableNotification
        };

        // Add thread ID for topic support
        if (threadId) {
            body.message_thread_id = parseInt(threadId, 10);
        }

        // Add inline keyboard if provided
        if (options?.inlineKeyboard) {
            body.reply_markup = {
                inline_keyboard: options.inlineKeyboard
            };
        }

        const response = await fetch(`${TELEGRAM_API_URL}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('[Telegram] API error response:', error);
            return { success: false, error };
        }

        await response.json();
        return { success: true };
    } catch (error) {
        console.error('[Telegram] Failed to send message:', error);
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
 * The owner's chat ID is configured in app.config.js (ownerTelegramChatId).
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
        console.warn('[Telegram] Owner notification skipped: ownerTelegramChatId not configured');
        return { success: false, error: 'Owner chat ID not configured' };
    }

    return sendToChat(ownerChatId, message, options);
}

// ============================================================================
// FEATURE REQUEST & BUG REPORT NOTIFICATIONS
// ============================================================================

/**
 * Get the base app URL
 *
 * Priority order:
 * 1. VERCEL_PROJECT_PRODUCTION_URL - Stable production domain (e.g., app-template-ai.vercel.app)
 * 2. VERCEL_URL - Deployment-specific URL (changes per deployment)
 * 3. NEXT_PUBLIC_APP_URL - Manual override (optional)
 * 4. localhost:3000 - Local development fallback
 *
 * Note: Vercel URLs don't include protocol, so we prepend https://
 */
function getBaseUrl(): string {
    // Stable production domain (recommended for production)
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
        return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    // Deployment-specific URL (preview deployments)
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    // Manual override (optional)
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    // Local development
    return 'http://localhost:3000';
}

/**
 * Send feature request notification when a new feature request is created
 * Includes "Approve" button for admin to approve and sync to GitHub
 */
export async function sendFeatureRequestNotification(request: FeatureRequestDocument): Promise<SendMessageResult> {
    const priorityEmoji = request.priority === 'critical' ? '🔴' : request.priority === 'high' ? '🟠' : '🟡';
    const description = request.description?.slice(0, 200) || 'No description';
    const truncated = (request.description?.length || 0) > 200 ? '...' : '';

    const messageParts = [
        '✨ <b>New Feature Request!</b>',
        '',
        `📋 <b>${request.title}</b>`,
        '',
        `${description}${truncated}`,
        '',
        `${priorityEmoji} Priority: ${request.priority || 'medium'}`,
    ];

    if (request.requestedByName) {
        messageParts.push(`👤 Requested by: ${request.requestedByName}`);
    }

    const message = messageParts.join('\n');

    // Add approve button
    const inlineKeyboard: InlineKeyboardButton[][] = [];
    const baseUrl = getBaseUrl();

    if (baseUrl.startsWith('https') && request.approvalToken) {
        // Callback data format: "approve_request:requestId"
        // Note: Token is verified from database when webhook is called
        // (Telegram has 64-byte limit on callback_data, so we can't include the token)
        inlineKeyboard.push([{
            text: '✅ Approve & Create GitHub Issue',
            callback_data: `approve_request:${request._id}`,
        }]);
    } else if (request.approvalToken) {
        // Fallback to URL button for non-HTTPS
        inlineKeyboard.push([{
            text: '✅ Approve & Create GitHub Issue',
            url: `${baseUrl}/api/feature-requests/approve/${request._id}?token=${request.approvalToken}`,
        }]);
    }

    return sendNotificationToOwner(message, {
        parseMode: 'HTML',
        inlineKeyboard: inlineKeyboard.length > 0 ? inlineKeyboard : undefined,
    });
}

/**
 * Send bug report notification when user submits a new bug
 * Includes "Approve" button if running on HTTPS
 */
export async function sendBugReportNotification(report: ReportDocument): Promise<SendMessageResult> {
    const category = report.category === 'performance' ? '⚡ Performance' : '🐛 Bug';
    const description = report.description?.slice(0, 200) || 'No description';
    const truncated = (report.description?.length || 0) > 200 ? '...' : '';

    const messageParts = [
        `${category} <b>New Bug Report!</b>`,
        '',
        `📋 ${description}${truncated}`,
        '',
        `📍 Route: ${report.route}`,
    ];

    if (report.userInfo?.username) {
        messageParts.push(`👤 Reported by: ${report.userInfo.username}`);
    }

    const message = messageParts.join('\n');

    // Add approve button if we have HTTPS (for callback support)
    const inlineKeyboard: InlineKeyboardButton[][] = [];
    const baseUrl = getBaseUrl();

    if (baseUrl.startsWith('https') && report.approvalToken) {
        // Callback data format: "approve_bug:reportId"
        // Note: Token is verified from database when webhook is called
        // (Telegram has 64-byte limit on callback_data, so we can't include the token)
        inlineKeyboard.push([{
            text: '✅ Approve & Create GitHub Issue',
            callback_data: `approve_bug:${report._id}`,
        }]);
    } else if (report.approvalToken) {
        // Fallback to URL button for non-HTTPS
        inlineKeyboard.push([{
            text: '✅ Approve & Create GitHub Issue',
            url: `${baseUrl}/api/reports/approve/${report._id}?token=${report.approvalToken}`,
        }]);
    }

    return sendNotificationToOwner(message, {
        parseMode: 'HTML',
        inlineKeyboard: inlineKeyboard.length > 0 ? inlineKeyboard : undefined,
    });
}

/**
 * Send routing notification after feature request is synced to GitHub
 * Asks admin where the feature should start (Product Dev, Product Design, Tech Design, Implementation, or Backlog)
 */
export async function sendFeatureRoutingNotification(
    request: FeatureRequestDocument,
    issueResult: { number: number; url: string }
): Promise<SendMessageResult> {
    const priorityEmoji = request.priority === 'critical' ? '🔴' : request.priority === 'high' ? '🟠' : '🟡';

    const message = [
        '✨ <b>Feature Request Synced to GitHub!</b>',
        '',
        `📋 ${request.title}`,
        `${priorityEmoji} Priority: ${request.priority || 'medium'}`,
        `🔗 Issue #${issueResult.number}`,
        '',
        '<b>Where should this feature start?</b>',
        '',
        '• <b>Product Dev</b> - Vague idea, needs product spec',
        '• <b>Product Design</b> - Needs UX/UI design',
        '• <b>Tech Design</b> - Needs architecture planning',
        '• <b>Implementation</b> - Simple feature, go straight to coding',
        '• <b>Backlog</b> - Keep in backlog for now',
    ].join('\n');

    const inlineKeyboard: InlineKeyboardButton[][] = [
        [
            { text: '📋 Product Dev', callback_data: `route_feature:${request._id}:product-dev` },
            { text: '🎨 Product Design', callback_data: `route_feature:${request._id}:product-design` },
        ],
        [
            { text: '🔧 Tech Design', callback_data: `route_feature:${request._id}:tech-design` },
            { text: '⚡ Implementation', callback_data: `route_feature:${request._id}:implementation` },
        ],
        [
            { text: '📋 Keep in Backlog', callback_data: `route_feature:${request._id}:backlog` },
            { text: '🔗 View Issue', url: issueResult.url },
        ],
    ];

    return sendNotificationToOwner(message, {
        parseMode: 'HTML',
        inlineKeyboard,
    });
}

/**
 * Send routing notification after bug report is synced to GitHub
 * Asks admin where the bug should start (Product Design, Tech Design, Implementation, or Backlog)
 */
export async function sendBugRoutingNotification(
    report: ReportDocument,
    issueResult: { number: number; url: string }
): Promise<SendMessageResult> {
    const category = report.category === 'performance' ? '⚡ Performance' : '🐛 Bug';
    const description = report.description?.slice(0, 100) || 'Bug Report';
    const truncated = (report.description?.length || 0) > 100 ? '...' : '';

    const message = [
        `${category} <b>Bug Synced to GitHub!</b>`,
        '',
        `📋 ${description}${truncated}`,
        `🔗 Issue #${issueResult.number}`,
        '',
        '<b>Where should this bug start?</b>',
        '',
        '• <b>Product Design</b> - UX/UI needs redesign',
        '• <b>Tech Design</b> - Needs architecture planning',
        '• <b>Implementation</b> - Simple fix, go straight to coding',
        '• <b>Backlog</b> - Keep in backlog for now',
    ].join('\n');

    const inlineKeyboard: InlineKeyboardButton[][] = [
        [
            { text: '🎨 Product Design', callback_data: `route_bug:${report._id}:product-design` },
            { text: '🔧 Tech Design', callback_data: `route_bug:${report._id}:tech-design` },
        ],
        [
            { text: '⚡ Implementation', callback_data: `route_bug:${report._id}:implementation` },
            { text: '📋 Keep in Backlog', callback_data: `route_bug:${report._id}:backlog` },
        ],
        [
            { text: '🔗 View Issue', url: issueResult.url },
        ],
    ];

    return sendNotificationToOwner(message, {
        parseMode: 'HTML',
        inlineKeyboard,
    });
}
