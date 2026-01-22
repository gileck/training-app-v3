/**
 * Telegram Notifications for Agent Scripts
 *
 * Provides notification functions for each step of the GitHub Projects workflow.
 * Supports inline keyboard buttons for quick approve/reject actions.
 */

import { agentConfig, getIssueUrl, getPrUrl, getProjectUrl } from './config';
import { appConfig } from '../../app.config';

// ============================================================
// TELEGRAM API
// ============================================================

const TELEGRAM_API_URL = 'https://api.telegram.org/bot';

interface SendResult {
    success: boolean;
    error?: string;
}

/**
 * Inline keyboard button for Telegram
 * Supports both callback buttons and URL buttons
 */
interface InlineButton {
    text: string;
    callback_data?: string;
    url?: string;
}

/**
 * Inline keyboard markup for Telegram
 */
interface InlineKeyboardMarkup {
    inline_keyboard: InlineButton[][];
}

/**
 * Get the owner's Telegram chat ID from app.config.js
 */
function getOwnerChatId(): string | null {
    return appConfig.ownerTelegramChatId || null;
}

/**
 * Build review action buttons for a PR (includes Open PR button)
 */
function buildPRReviewButtons(issueNumber: number, prUrl: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '🔀 Open PR', url: prUrl },
            ],
            [
                { text: '✅ Approve', callback_data: `approve:${issueNumber}` },
                { text: '📝 Request Changes', callback_data: `changes:${issueNumber}` },
                { text: '❌ Reject', callback_data: `reject:${issueNumber}` },
            ],
        ],
    };
}

/**
 * Build buttons with View Issue + review actions
 */
function buildIssueReviewButtons(issueNumber: number, issueUrl: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '📋 View Issue', url: issueUrl },
            ],
            [
                { text: '✅ Approve', callback_data: `approve:${issueNumber}` },
                { text: '📝 Request Changes', callback_data: `changes:${issueNumber}` },
                { text: '❌ Reject', callback_data: `reject:${issueNumber}` },
            ],
        ],
    };
}

/**
 * Build simple View Issue button
 */
function buildViewIssueButton(issueUrl: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '📋 View Issue', url: issueUrl }],
        ],
    };
}

/**
 * Build View Project button
 */
function buildViewProjectButton(projectUrl: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [{ text: '🗂 View Project', url: projectUrl }],
        ],
    };
}

/**
 * Send a Telegram message to the admin/owner
 */
async function sendToAdmin(
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

    const chatId = getOwnerChatId();
    if (!chatId) {
        console.warn('  Telegram notification skipped: ownerTelegramChatId not configured');
        return { success: false, error: 'Owner chat ID not configured' };
    }

    try {
        const body: Record<string, unknown> = {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        };

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
            console.error('  Telegram API error:', error);
            return { success: false, error };
        }

        console.log('  Telegram notification sent');
        return { success: true };
    } catch (error) {
        console.error('  Failed to send Telegram notification:', error);
        return { success: false, error: String(error) };
    }
}

// ============================================================
// NOTIFICATION TEMPLATES
// ============================================================

/**
 * Notify admin that a feature request was synced to GitHub
 */
export async function notifyIssueSynced(
    title: string,
    issueNumber: number,
    status: string
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const message = `<b>Agent (Sync):</b> ✅ Feature request synced to GitHub

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}
📊 Status: ${status}

Waiting for product design generation.`;

    return sendToAdmin(message, buildViewIssueButton(issueUrl));
}

/**
 * Notify admin that product design is ready for review
 */
export async function notifyProductDesignReady(
    title: string,
    issueNumber: number,
    isRevision: boolean = false,
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const status = isRevision ? '🔄 Revised' : '✅ Ready for Review';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const message = `<b>Agent (Product Design):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}
📊 Status: Product Design (Waiting for Review)

${isRevision ? 'Design updated based on feedback. ' : ''}Review and approve to proceed to Technical Design.`;

    return sendToAdmin(message, buildIssueReviewButtons(issueNumber, issueUrl));
}

/**
 * Notify admin that technical design is ready for review
 */
export async function notifyTechDesignReady(
    title: string,
    issueNumber: number,
    isRevision: boolean = false,
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const status = isRevision ? '🔄 Revised' : '✅ Ready for Review';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const message = `<b>Agent (Tech Design):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}
📊 Status: Technical Design (Waiting for Review)

${isRevision ? 'Design updated based on feedback. ' : ''}Review and approve to proceed to Implementation.`;

    return sendToAdmin(message, buildIssueReviewButtons(issueNumber, issueUrl));
}

/**
 * Notify admin that PR is ready for review
 */
export async function notifyPRReady(
    title: string,
    issueNumber: number,
    prNumber: number,
    isRevision: boolean = false,
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const prUrl = getPrUrl(prNumber);

    const status = isRevision ? '🔄 PR Updated' : '✅ PR Ready';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const message = `<b>Agent (Implementation):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber} → PR #${prNumber}
📊 Status: PR Review (Waiting for Review)

${isRevision ? 'Changes made based on feedback. ' : ''}Review and merge to complete.`;

    return sendToAdmin(message, buildPRReviewButtons(issueNumber, prUrl));
}

/**
 * Notify admin that PR review is complete
 */
export async function notifyPRReviewComplete(
    title: string,
    issueNumber: number,
    prNumber: number,
    decision: 'approved' | 'request_changes',
    summary: string,
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const prUrl = getPrUrl(prNumber);
    const issueUrl = getIssueUrl(issueNumber);

    const status = decision === 'approved' ? '✅ PR Approved' : '📝 Changes Requested';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const message = `<b>Agent (PR Review):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber} → PR #${prNumber}
📊 Status: ${decision === 'approved' ? 'Approved - Ready to Merge' : 'Changes Requested - Implementation'}

<b>Summary:</b> ${escapeHtml(summary)}`;

    const buttons: InlineKeyboardMarkup = {
        inline_keyboard: [
            [
                { text: '🔀 View PR', url: prUrl },
                { text: '📋 View Issue', url: issueUrl },
            ],
        ],
    };

    return sendToAdmin(message, buttons);
}

/**
 * Notify admin that agent needs clarification
 */
export async function notifyAgentNeedsClarification(
    phase: string,
    title: string,
    issueNumber: number,
    question: string,
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';
    const issueUrl = getIssueUrl(issueNumber);

    // Truncate question for Telegram (max 4000 chars total)
    // Reserve ~1000 chars for header/footer
    const maxQuestionLength = 2800;
    const truncatedQuestion = question.length > maxQuestionLength
        ? question.slice(0, maxQuestionLength) + '...\n\n<i>[See full question in GitHub issue]</i>'
        : question;

    const message = `🤔 <b>Agent Needs Clarification</b>

<b>Phase:</b> ${phase}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}

<b>Question:</b>

${escapeHtml(truncatedQuestion)}`;

    const buttons: InlineKeyboardMarkup = {
        inline_keyboard: [
            [
                { text: '📋 View Issue & Respond', url: issueUrl },
            ],
            [
                { text: '✅ Clarification Received', callback_data: `clarified:${issueNumber}` },
            ],
        ],
    };

    return sendToAdmin(message, buttons);
}

/**
 * Notify admin of an agent error
 */
export async function notifyAgentError(
    phase: string,
    title: string,
    issueNumber: number | null,
    error: string
): Promise<SendResult> {
    const issueUrl = issueNumber ? getIssueUrl(issueNumber) : null;
    const issueInfo = issueNumber ? `\n🔗 Issue #${issueNumber}` : '';

    const message = `<b>Agent (${phase}):</b> ❌ Error

📋 ${escapeHtml(title)}${issueInfo}
⚠️ ${escapeHtml(error.slice(0, 200))}

Check logs for details.`;

    const buttons = issueUrl ? buildViewIssueButton(issueUrl) : undefined;
    return sendToAdmin(message, buttons);
}

/**
 * Notify admin of batch processing completion
 */
export async function notifyBatchComplete(
    phase: string,
    processed: number,
    succeeded: number,
    failed: number
): Promise<SendResult> {
    const status = failed === 0 ? '✅ Batch Complete' : '⚠️ Batch Complete (with errors)';
    const projectUrl = getProjectUrl();

    const message = `<b>Agent (${phase}):</b> ${status}

📊 Processed: ${processed} | ✅ ${succeeded}${failed > 0 ? ` | ❌ ${failed}` : ''}

${failed > 0 ? 'Check logs for failed items.' : 'All items processed successfully.'}`;

    return sendToAdmin(message, buildViewProjectButton(projectUrl));
}

// ============================================================
// UTILITIES
// ============================================================

/**
 * Escape HTML special characters for Telegram HTML mode
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Notify admin that an item was auto-advanced to the next phase
 */
export async function notifyAutoAdvance(
    title: string,
    issueNumber: number,
    fromStatus: string,
    toStatus: string
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const message = `<b>Agent (Auto-Advance):</b> ⏭️ Status Updated

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}
📊 ${escapeHtml(fromStatus)} → ${escapeHtml(toStatus)}

Ready for next phase.`;

    return sendToAdmin(message, buildViewIssueButton(issueUrl));
}

/**
 * Send a custom notification message
 */
export async function notifyAdmin(message: string): Promise<SendResult> {
    return sendToAdmin(message);
}

/**
 * Notify admin that an agent has started working on an item
 */
export async function notifyAgentStarted(
    phase: string,
    title: string,
    issueNumber: number,
    mode: 'new' | 'feedback' | 'clarification',
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const status =
        mode === 'new'
            ? '🚀 Started'
            : mode === 'feedback'
              ? '🔄 Addressing Feedback'
              : '💬 Resuming After Clarification';
    const issueUrl = getIssueUrl(issueNumber);
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const message = `<b>Agent (${phase}):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}`;

    return sendToAdmin(message, buildViewIssueButton(issueUrl));
}
