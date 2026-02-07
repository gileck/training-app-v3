/**
 * Telegram Notifications for Agent Scripts
 *
 * Provides notification functions for each step of the GitHub Projects workflow.
 * Supports inline keyboard buttons for quick approve/reject actions.
 */

import { agentConfig, getIssueUrl, getPrUrl, getProjectUrl } from './config';
import { appConfig } from '../../app.config';
import { generateClarificationToken } from '@/apis/template/clarification/utils';
import { generateDecisionToken } from '@/apis/template/agent-decision/utils';

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
 * Get the owner's Telegram chat ID from app.config.js
 * Returns parsed chat ID and optional thread ID for topic-based groups
 */
function getOwnerChatId(): { chatId: string; threadId?: number } | null {
    const rawChatId = appConfig.ownerTelegramChatId;
    if (!rawChatId) return null;
    return parseChatId(rawChatId);
}

/**
 * Build simple View PR button (for implementation PRs)
 * Implementation PRs should be reviewed by PR Review agent, not manually approved
 */
function buildViewPRButton(prUrl: string): InlineKeyboardMarkup {
    return {
        inline_keyboard: [
            [
                { text: '🔀 View PR', url: prUrl },
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
 * Sleep for a specified number of milliseconds
 */
async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send a Telegram message to the admin/owner
 * Retries up to 3 times with 3 second delays on failure
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

    const parsedChatId = getOwnerChatId();
    if (!parsedChatId) {
        console.warn('  Telegram notification skipped: ownerTelegramChatId not configured');
        return { success: false, error: 'Owner chat ID not configured' };
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
 * Notify admin that product development document is ready for review
 */
export async function notifyProductDevelopmentReady(
    title: string,
    issueNumber: number,
    isRevision: boolean = false,
    summary?: string
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const status = isRevision ? '🔄 Revised' : '✅ Ready for Review';

    const summarySection = summary ? `\n\n<b>${isRevision ? 'Changes:' : 'Overview:'}</b>\n${escapeHtml(summary)}` : '';

    const message = `<b>Agent (Product Development):</b> ${status}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}
📊 Status: Product Development (Waiting for Review)

${isRevision ? 'Document updated based on feedback. ' : ''}Review and approve to proceed to Product Design.${summarySection}`;

    return sendToAdmin(message, buildIssueReviewButtons(issueNumber, issueUrl));
}

/**
 * Notify admin that product design is ready for review
 */
export async function notifyProductDesignReady(
    title: string,
    issueNumber: number,
    isRevision: boolean = false,
    itemType: 'bug' | 'feature' = 'feature',
    summary?: string
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const status = isRevision ? '🔄 Revised' : '✅ Ready for Review';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const summarySection = summary ? `\n\n<b>${isRevision ? 'Changes:' : 'Overview:'}</b>\n${escapeHtml(summary)}` : '';

    const message = `<b>Agent (Product Design):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}
📊 Status: Product Design (Waiting for Review)

${isRevision ? 'Design updated based on feedback. ' : ''}Review and approve to proceed to Technical Design.${summarySection}`;

    return sendToAdmin(message, buildIssueReviewButtons(issueNumber, issueUrl));
}

/**
 * Notify admin that technical design is ready for review
 */
export async function notifyTechDesignReady(
    title: string,
    issueNumber: number,
    isRevision: boolean = false,
    itemType: 'bug' | 'feature' = 'feature',
    summary?: string
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const status = isRevision ? '🔄 Revised' : '✅ Ready for Review';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const summarySection = summary ? `\n\n<b>${isRevision ? 'Changes:' : 'Plan:'}</b>\n${escapeHtml(summary)}` : '';

    const message = `<b>Agent (Tech Design):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}
📊 Status: Technical Design (Waiting for Review)

${isRevision ? 'Design updated based on feedback. ' : ''}Review and approve to proceed to Implementation.${summarySection}`;

    return sendToAdmin(message, buildIssueReviewButtons(issueNumber, issueUrl));
}

/**
 * Notify admin that PR is ready for review
 * Implementation PRs will be reviewed by PR Review agent (cron job)
 * Only shows View PR button - no manual approve/reject actions
 */
export async function notifyPRReady(
    title: string,
    issueNumber: number,
    prNumber: number,
    isRevision: boolean = false,
    itemType: 'bug' | 'feature' = 'feature',
    summary?: string
): Promise<SendResult> {
    const prUrl = getPrUrl(prNumber);

    const status = isRevision ? '🔄 PR Updated' : '✅ PR Ready';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const summarySection = summary ? `\n\n<b>${isRevision ? 'Changes:' : 'Summary:'}</b>\n${escapeHtml(summary)}` : '';

    const message = `<b>Agent (Implementation):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber} → PR #${prNumber}
📊 Status: PR Review (Waiting for Review)

${isRevision ? 'PR updated based on feedback. ' : ''}Waiting for PR Review agent to review.${summarySection}`;

    return sendToAdmin(message, buildViewPRButton(prUrl));
}

/**
 * Notify admin that PR review is complete
 * NOTE: This is the legacy notification. For approved PRs, use notifyPRReadyToMerge instead.
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
 * Notify admin that PR is approved and ready to merge
 * Shows commit message preview with Merge/Request Changes buttons
 */
export async function notifyPRReadyToMerge(
    issueTitle: string,
    issueNumber: number,
    prNumber: number,
    commitMessage: { title: string; body: string },
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const prUrl = getPrUrl(prNumber);

    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    // Truncate body for Telegram (keep it readable, allow more content for commit summaries)
    const bodyPreview = commitMessage.body.length > 500
        ? commitMessage.body.substring(0, 500) + '...'
        : commitMessage.body;

    const message = `<b>Agent (PR Review):</b> ✅ Approved!
${typeEmoji} ${typeLabel}

<b>Issue:</b> ${escapeHtml(issueTitle)} (#${issueNumber})
<b>PR:</b> #${prNumber}

<b>Commit Message:</b>
<code>${escapeHtml(commitMessage.title)}</code>

${escapeHtml(bodyPreview)}`;

    const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [[
            { text: '✅ Merge', callback_data: `merge:${issueNumber}:${prNumber}` },
            { text: '🔄 Request Changes', callback_data: `reqchanges:${issueNumber}:${prNumber}` },
        ], [
            { text: '👀 View PR', url: prUrl },
        ]],
    };

    return sendToAdmin(message, keyboard);
}

/**
 * Notify admin that merge was successful
 */
export async function notifyMergeComplete(
    issueTitle: string,
    issueNumber: number,
    prNumber: number
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const message = `<b>Merged:</b> ✅ PR #${prNumber}

${escapeHtml(issueTitle)} (#${issueNumber})

Issue will be marked as Done.`;

    return sendToAdmin(message, buildViewIssueButton(issueUrl));
}

/**
 * Get the base app URL for clarification links
 *
 * Uses appConfig.appUrl which has the following priority:
 * 1. NEXT_PUBLIC_APP_URL - Manual override
 * 2. VERCEL_PROJECT_PRODUCTION_URL - Stable production domain
 * 3. VERCEL_URL - Deployment-specific URL
 * 4. Default production URL from config
 */
function getAppUrl(): string {
    return appConfig.appUrl;
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

    // Generate clarification URL with token
    const token = generateClarificationToken(issueNumber);
    const clarifyUrl = `${getAppUrl()}/clarify/${issueNumber}?token=${token}`;

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
                { text: '💬 ANSWER QUESTIONS', url: clarifyUrl },
            ],
            [
                { text: '📋 View Issue', url: issueUrl },
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

/**
 * Notify admin that design PR is ready for review
 * Shows Approve & Merge / Request Changes buttons for direct action
 */
export async function notifyDesignPRReady(
    designType: 'product-dev' | 'product' | 'tech',
    title: string,
    issueNumber: number,
    prNumber: number,
    isRevision: boolean = false,
    itemType: 'bug' | 'feature' = 'feature',
    summary?: string
): Promise<SendResult> {
    const prUrl = getPrUrl(prNumber);

    const designLabel = designType === 'product-dev'
        ? 'Product Development'
        : designType === 'product'
            ? 'Product Design'
            : 'Technical Design';
    const status = isRevision ? '🔄 PR Updated' : '✅ PR Ready';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const summarySection = summary ? `\n\n<b>${isRevision ? 'Changes:' : 'Overview:'}</b>\n${escapeHtml(summary)}` : '';

    const message = `<b>Agent (${designLabel}):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber} → PR #${prNumber}
📊 Status: ${designLabel} (Waiting for Review)

${isRevision ? 'Design updated based on feedback. ' : ''}Review and merge to proceed.${summarySection}`;

    const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [[
            { text: '✅ Approve & Merge', callback_data: `design_approve:${prNumber}:${issueNumber}:${designType}` },
            { text: '📝 Request Changes', callback_data: `design_changes:${prNumber}:${issueNumber}:${designType}` },
        ], [
            { text: '👀 View PR', url: prUrl },
        ]],
    };

    return sendToAdmin(message, keyboard);
}

/**
 * Notify admin that Final Review is ready (feature branch workflow)
 * All phases complete, final PR from feature branch to main awaits admin verification
 */
export async function notifyFinalReviewReady(
    title: string,
    issueNumber: number,
    prNumber: number,
    totalPhases: number,
    itemType: 'bug' | 'feature' = 'feature',
    summary?: string
): Promise<SendResult> {
    const prUrl = getPrUrl(prNumber);
    const issueUrl = getIssueUrl(issueNumber);

    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const summarySection = summary ? `\n\n<b>Summary:</b>\n${escapeHtml(summary)}` : '';

    const message = `<b>Agent (Final Review):</b> 🎯 Ready for Verification
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber} → Final PR #${prNumber}
📊 Status: Final Review (${totalPhases} phases complete)

All implementation phases are complete. Verify the feature via preview deployment and merge to main.${summarySection}`;

    // Note: Vercel automatically adds deployment preview to PR
    // Admin can click "View PR" to see the preview link in the PR
    const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [[
            { text: '✅ Merge to Main', callback_data: `merge_final:${issueNumber}:${prNumber}` },
        ], [
            { text: '👀 View PR (with Preview)', url: prUrl },
            { text: '📋 View Issue', url: issueUrl },
        ]],
    };

    return sendToAdmin(message, keyboard);
}

/**
 * Notify admin that a phase of a multi-PR feature was completed
 */
export async function notifyPhaseComplete(
    currentPhase: number,
    totalPhases: number,
    title: string,
    issueNumber: number,
    prNumber: number
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);
    const prUrl = getPrUrl(prNumber);

    const isLastPhase = currentPhase >= totalPhases;
    const status = isLastPhase
        ? `✅ All ${totalPhases} phases complete!`
        : `✅ Phase ${currentPhase}/${totalPhases} merged`;

    const nextAction = isLastPhase
        ? 'Issue will be marked as Done.'
        : `Starting Phase ${currentPhase + 1}/${totalPhases}...`;

    const message = `<b>Agent (Multi-PR):</b> ${status}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber} → PR #${prNumber}

${nextAction}`;

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
 * Notify admin that a phase was merged to feature branch (feature branch workflow)
 * Used when a phase PR is merged to the feature branch, not to main
 */
export async function notifyPhaseMergedToFeatureBranch(
    currentPhase: number,
    totalPhases: number,
    title: string,
    issueNumber: number,
    prNumber: number
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);
    const prUrl = getPrUrl(prNumber);

    const isLastPhase = currentPhase >= totalPhases;
    const status = isLastPhase
        ? `✅ Phase ${currentPhase}/${totalPhases} merged to feature branch`
        : `✅ Phase ${currentPhase}/${totalPhases} merged to feature branch`;

    const nextAction = isLastPhase
        ? 'Creating final PR to main...'
        : `Ready for Phase ${currentPhase + 1}/${totalPhases}`;

    const message = `<b>Agent (Feature Branch):</b> ${status}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber} → PR #${prNumber}

${nextAction}`;

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
 * Notify admin that final PR was merged (feature branch workflow complete)
 */
export async function notifyFinalMergeComplete(
    title: string,
    issueNumber: number,
    prNumber: number,
    totalPhases: number
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const message = `<b>Agent (Feature Branch):</b> 🎉 Feature Complete!

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber} → Final PR #${prNumber}
📊 ${totalPhases} phases merged to main

Issue will be marked as Done. Branches cleaned up.`;

    return sendToAdmin(message, buildViewIssueButton(issueUrl));
}

/**
 * Notify admin that an agent decision is ready and needs selection.
 * Generic version that works for any agent decision type.
 */
export async function notifyDecisionNeeded(
    phase: string,
    title: string,
    issueNumber: number,
    summary: string,
    optionsCount: number,
    itemType: 'bug' | 'feature' = 'feature',
    isRevision: boolean = false
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const status = isRevision ? '🔄 Revised' : '✅ Decision Ready';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug' : 'Feature';

    // Generate decision URL with token
    const token = generateDecisionToken(issueNumber);
    const decisionUrl = `${getAppUrl()}/decision/${issueNumber}?token=${token}`;

    // Truncate summary for Telegram (max 2800 chars to leave room for header)
    const truncatedSummary = summary.length > 2800
        ? summary.slice(0, 2800) + '...'
        : summary;

    const message = `<b>Agent (${escapeHtml(phase)}):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}
📊 Options: ${optionsCount}

<b>Summary:</b>
${escapeHtml(truncatedSummary)}`;

    const buttons: InlineKeyboardMarkup = {
        inline_keyboard: [
            [
                { text: '🔧 Choose Option', url: decisionUrl },
            ],
            [
                { text: '📋 View Issue', url: issueUrl },
            ],
            [
                { text: '📝 Request Changes', callback_data: `changes:${issueNumber}` },
            ],
        ],
    };

    return sendToAdmin(message, buttons);
}
