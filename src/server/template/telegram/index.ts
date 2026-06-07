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
import { requireAppUrl } from '@/server/template/appUrl';

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

/**
 * Convert basic Markdown to Telegram HTML.
 * Handles: **bold**, `code`, _italic_, > blockquote, ## headers
 */
function markdownToTelegramHtml(text: string): string {
    let result = text
        // Escape HTML special chars first (except our markdown)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Then convert markdown to HTML
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')      // **bold**
        .replace(/`(.+?)`/g, '<code>$1</code>');     // `code`

    // Protect code blocks from underscore-to-italic conversion by using placeholders.
    // This prevents underscores in code (e.g., snake_case_var) from being corrupted.
    // Placeholder uses \x00 (null char) to avoid any regex pattern conflicts.
    const codeBlocks: string[] = [];
    result = result.replace(/<code>(.+?)<\/code>/g, (_match, content) => {
        codeBlocks.push(content);
        return `<code>\x00CODE${codeBlocks.length - 1}\x00</code>`;
    });

    // Apply remaining conversions (safe now that code content is protected)
    result = result
        .replace(/_(.+?)_/g, '<i>$1</i>')            // _italic_
        .replace(/^## (.+)$/gm, '<b>$1</b>')         // ## header
        .replace(/^&gt; (.+)$/gm, '<i>$1</i>');      // > blockquote (already escaped)

    // Restore code block contents from placeholders
    codeBlocks.forEach((content, index) => {
        result = result.replace(`\x00CODE${index}\x00`, content);
    });

    return result;
}

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
 * Get priority emoji for a given priority level
 */
function getPriorityEmoji(priority?: string): string {
    if (priority === 'critical') return '🔴';
    if (priority === 'high') return '🟠';
    return '🟡';
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

/**
 * Send a Telegram notification to the agent workflow channel.
 * Uses AGENT_TELEGRAM_CHAT_ID env var, falls back to ownerTelegramChatId.
 */
async function sendNotificationToAgent(
    message: string,
    options?: SendMessageOptions
): Promise<SendMessageResult> {
    const agentChatId = process.env.AGENT_TELEGRAM_CHAT_ID || appConfig.ownerTelegramChatId;

    if (!agentChatId) {
        console.warn('[Telegram] Agent notification skipped: AGENT_TELEGRAM_CHAT_ID not configured');
        return { success: false, error: 'Agent chat ID not configured' };
    }

    return sendToChat(agentChatId, message, options);
}

// ============================================================================
// FEATURE REQUEST & BUG REPORT NOTIFICATIONS
// ============================================================================

/**
 * Get the base app URL (no trailing slash). Resolves from the single source of
 * truth — `requireAppUrl()` from `@/server/template/appUrl` (localhost in dev). Throws
 * a clear error in production when unset, rather than building broken links.
 */
export function getBaseUrl(): string {
    return requireAppUrl();
}

/**
 * Send feature request notification when a new feature request is created.
 * Notifies the owner with a link to the admin detail page.
 */
export async function sendFeatureRequestNotification(request: FeatureRequestDocument): Promise<SendMessageResult> {
    const priorityEmoji = getPriorityEmoji(request.priority);
    const rawDescription = request.description?.slice(0, 200) || 'No description';
    const truncated = (request.description?.length || 0) > 200 ? '...' : '';
    const description = markdownToTelegramHtml(rawDescription);

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

    const baseUrl = getBaseUrl();
    const inlineKeyboard: InlineKeyboardButton[][] = [];

    // View details link (only when not on localhost — Telegram rejects localhost URLs)
    if (!baseUrl.includes('localhost')) {
        inlineKeyboard.push([{
            text: '🔍 View Full Details',
            url: `${baseUrl}/admin/feature-requests/${request._id}`,
        }]);
    }

    return sendNotificationToAgent(message, {
        parseMode: 'HTML',
        inlineKeyboard,
    });
}

/**
 * Send bug report notification when user submits a new bug.
 * Notifies the owner with a link to the admin reports page.
 */
export async function sendBugReportNotification(report: ReportDocument): Promise<SendMessageResult> {
    const category = report.category === 'performance' ? '⚡ Performance' : '🐛 Bug';
    const rawDescription = report.description || 'No description';

    // Extract Priority/Size/Complexity/Risk metadata from description (if present from code reviewer)
    const metadataRegex = /\*\*Priority:\*\*\s*([^|]+)\|\s*\*\*Size:\*\*\s*([^|]+)\|\s*\*\*Complexity:\*\*\s*([^|]+)\|\s*\*\*Risk:\*\*\s*(.+)/;
    const metadataMatch = rawDescription.match(metadataRegex);

    // Remove the metadata line from description to display it separately at the end
    const cleanDescription = metadataMatch
        ? rawDescription.replace(metadataRegex, '').trim()
        : rawDescription;

    const description = markdownToTelegramHtml(cleanDescription);

    const messageParts = [
        `${category} <b>New Bug Report!</b>`,
        '',
        `📋 ${description}`,
    ];

    if (report.route) {
        messageParts.push('', `📍 Route: ${report.route}`);
    }

    if (report.userInfo?.username) {
        messageParts.push(`👤 Reported by: ${report.userInfo.username}`);
    }

    // Append metadata on separate lines at the end
    if (metadataMatch) {
        messageParts.push(
            '',
            `Priority: ${metadataMatch[1].trim()}`,
            `Size: ${metadataMatch[2].trim()}`,
            `Complexity: ${metadataMatch[3].trim()}`,
            `Risk: ${metadataMatch[4].trim()}`,
        );
    }

    const message = messageParts.join('\n');

    const baseUrl = getBaseUrl();
    const inlineKeyboard: InlineKeyboardButton[][] = [];

    // View reports link (only when not on localhost — Telegram rejects localhost URLs)
    if (!baseUrl.includes('localhost')) {
        inlineKeyboard.push([{
            text: '🔍 View Reports',
            url: `${baseUrl}/admin/reports`,
        }]);
    }

    return sendNotificationToAgent(message, {
        parseMode: 'HTML',
        inlineKeyboard,
    });
}
