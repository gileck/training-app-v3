/**
 * Workflow Service Notifications
 *
 * Centralized Telegram notifications for all workflow operations.
 * Uses two channels:
 * - AGENT_TELEGRAM_CHAT_ID: actionable messages (approve routing buttons)
 * - AGENT_INFO_TELEGRAM_CHAT_ID: informational messages (routed, deleted confirmations)
 *
 * All functions are fire-and-forget — they catch errors and log warnings.
 */

import { sendTelegramNotification, sendFeatureRoutingNotification, sendBugRoutingNotification } from '@/server/template/telegram';
import { featureRequests, reports } from '@/server/database';
import { appConfig } from '@/app.config';
import type { WorkflowItemRef, ApproveResult } from './types';
import { ROUTING_DESTINATION_LABELS } from './constants';

/**
 * Get the info channel chat ID (non-actionable notifications)
 * Falls back to actionable channel → owner chat ID
 */
function getInfoChatId(): string | null {
    return process.env.AGENT_INFO_TELEGRAM_CHAT_ID
        || process.env.AGENT_TELEGRAM_CHAT_ID
        || appConfig.ownerTelegramChatId
        || null;
}

/**
 * Send notification after approval.
 *
 * For features: sends routing buttons to AGENT_TELEGRAM_CHAT_ID (actionable)
 * For bugs: sends info message to AGENT_INFO_TELEGRAM_CHAT_ID (auto-routed to Bug Investigation)
 */
export async function notifyApproved(ref: WorkflowItemRef, result: ApproveResult): Promise<void> {
    try {
        if (!result.issueNumber || !result.issueUrl) return;

        if (ref.type === 'feature') {
            const request = await featureRequests.findFeatureRequestById(ref.id);
            if (!request) return;
            await sendFeatureRoutingNotification(request, {
                number: result.issueNumber,
                url: result.issueUrl,
            });
        } else {
            const report = await reports.findReportById(ref.id);
            if (!report) return;
            await sendBugRoutingNotification(report, {
                number: result.issueNumber,
                url: result.issueUrl,
            });
        }
    } catch (error) {
        console.warn('[workflow-service] Failed to send approval notification:', error);
    }
}

/**
 * Send notification after routing.
 * INFO channel: "Routed to {destination}" with View Issue button.
 */
export async function notifyRouted(ref: WorkflowItemRef, destination: string, issueUrl?: string, issueNumber?: number): Promise<void> {
    try {
        const chatId = getInfoChatId();
        if (!chatId) return;

        const label = ROUTING_DESTINATION_LABELS[destination] || destination;
        const typeEmoji = ref.type === 'feature' ? '✨' : '🐛';
        const typeLabel = ref.type === 'feature' ? 'Feature' : 'Bug';

        const message = `${typeEmoji} <b>${typeLabel} Routed</b>\n\n✅ Routed to: <b>${label}</b>${issueNumber ? `\n🔗 Issue #${issueNumber}` : ''}`;

        const inlineKeyboard = issueUrl
            ? [[{ text: '📋 View Issue', url: issueUrl }]]
            : undefined;

        await sendTelegramNotification(chatId, message, {
            parseMode: 'HTML',
            inlineKeyboard,
        });
    } catch (error) {
        console.warn('[workflow-service] Failed to send routing notification:', error);
    }
}

/**
 * Send notification after deletion.
 * INFO channel: "Deleted: {title}"
 */
export async function notifyDeleted(ref: WorkflowItemRef, title: string): Promise<void> {
    try {
        const chatId = getInfoChatId();
        if (!chatId) return;

        const typeEmoji = ref.type === 'feature' ? '✨' : '🐛';
        const typeLabel = ref.type === 'feature' ? 'Feature' : 'Bug';

        const message = `${typeEmoji} <b>${typeLabel} Deleted</b>\n\n🗑 ${title}`;

        await sendTelegramNotification(chatId, message, { parseMode: 'HTML' });
    } catch (error) {
        console.warn('[workflow-service] Failed to send deletion notification:', error);
    }
}
