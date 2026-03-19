/**
 * Notification sender functions for the agent workflow.
 *
 * Each function composes a message using helpers, attaches keyboard buttons,
 * and sends via the Telegram API layer.
 */

import { getIssueUrl, getPrUrl, getProjectUrl } from '../config';
import { generateClarificationToken } from '@/apis/template/clarification/utils';
import { generateDecisionToken } from '@/apis/template/agent-decision/utils';
import { addHistoryEntry } from '@/server/database/collections/template/workflow-items';

import type { SendResult, InlineButton, InlineKeyboardMarkup } from './types';
import { escapeHtml, getAppUrl } from './helpers';
import {
    buildViewPRButton,
    buildIssueReviewButtons,
    buildViewIssueButton,
    buildViewProjectButton,
} from './buttons';
import { sendToAdmin, sendToInfoChannel } from './telegram-api';

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

    return sendToInfoChannel(message, buildViewIssueButton(issueUrl));
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

    return sendToInfoChannel(message, buildViewPRButton(prUrl));
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

    return sendToInfoChannel(message, buttons);
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

    return sendToInfoChannel(message, buildViewIssueButton(issueUrl));
}

/**
 * Notify admin that an agent decision was auto-submitted (obvious fix).
 * Sent when the bug investigator auto-selects the recommended fix option.
 */
export async function notifyDecisionAutoSubmitted(
    phase: string,
    title: string,
    issueNumber: number,
    selectedOptionTitle: string,
    routedTo: string,
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug' : 'Feature';

    const message = `<b>Agent (${escapeHtml(phase)}):</b> ⚡ Auto-Submitted
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}

<b>Selected:</b> ${escapeHtml(selectedOptionTitle)}
<b>Routed to:</b> ${escapeHtml(routedTo)}

Obvious fix auto-submitted. The implementation agent will pick this up next.`;

    return sendToInfoChannel(message, buildViewIssueButton(issueUrl));
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
    return sendToInfoChannel(message, buttons);
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

    return sendToInfoChannel(message, buildViewProjectButton(projectUrl));
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

    return sendToInfoChannel(message, buildViewIssueButton(issueUrl));
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
    mode: 'new' | 'feedback' | 'clarification' | 'post-selection',
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const status =
        mode === 'new'
            ? '🚀 Started'
            : mode === 'feedback'
              ? '🔄 Addressing Feedback'
              : mode === 'post-selection'
                ? '📝 Writing Design for Chosen Option'
                : '💬 Resuming After Clarification';
    const issueUrl = getIssueUrl(issueNumber);
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const message = `<b>Agent (${phase}):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}`;

    // Log history (fire-and-forget, non-critical)
    const modeLabel = mode === 'new' ? 'started' : mode === 'feedback' ? 'addressing feedback' : mode === 'post-selection' ? 'writing design for chosen option' : 'resuming after clarification';
    addHistoryEntry(issueNumber, {
        action: 'agent_started',
        description: `Agent ${phase} ${modeLabel}`,
        timestamp: new Date().toISOString(),
        actor: `agent:${phase.toLowerCase().replace(/ /g, '-')}`,
    }).catch(() => {});

    return sendToInfoChannel(message, buildViewIssueButton(issueUrl));
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
    const status = isRevision ? '🔄 Design Updated' : '✅ Design Ready';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug Fix' : 'Feature';

    const summarySection = summary ? `\n\n<b>${isRevision ? 'Changes:' : 'Overview:'}</b>\n${escapeHtml(summary)}` : '';

    const message = `<b>Agent (${designLabel}):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber} → PR #${prNumber}
📊 Status: ${designLabel} (Waiting for Review)

${isRevision ? 'Design updated based on feedback. ' : ''}Review and approve to proceed.${summarySection}`;

    const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: [[
            { text: '✅ Approve', callback_data: `design_approve:${prNumber}:${issueNumber}:${designType}` },
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

    return sendToInfoChannel(message, buttons);
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

    return sendToInfoChannel(message, buttons);
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

    return sendToInfoChannel(message, buildViewIssueButton(issueUrl));
}

/**
 * Notify admin that a decision selection was submitted via the web UI.
 * Confirms which option was selected and where the item was routed.
 */
export async function notifyDecisionSubmitted(
    title: string,
    issueNumber: number,
    selectedOptionTitle: string,
    routedTo: string | undefined,
    itemType: 'bug' | 'feature' = 'feature'
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug' : 'Feature';

    const routedSection = routedTo
        ? `<b>Routed to:</b> ${escapeHtml(routedTo)}\n\nThe next agent will pick this up automatically.`
        : 'Selection recorded. The agent will process this in the next workflow run.';

    const message = `<b>Decision Submitted:</b> ✅ Confirmed
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}

<b>Selected:</b> ${escapeHtml(selectedOptionTitle)}
${routedSection}`;

    return sendToInfoChannel(message, buildViewIssueButton(issueUrl));
}

/**
 * Notify admin that workflow review is complete
 */
export async function notifyWorkflowReviewComplete(
    title: string,
    issueNumber: number,
    reviewSummary: string,
    findingsCount: number
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const message = `<b>Workflow Review:</b> ✅ Complete

📋 ${escapeHtml(title)} (#${issueNumber})
📊 ${findingsCount} finding(s)

${escapeHtml(reviewSummary)}`;

    return sendToInfoChannel(message, buildViewIssueButton(issueUrl));
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
    isRevision: boolean = false,
    previewUrl?: string | null
): Promise<SendResult> {
    const issueUrl = getIssueUrl(issueNumber);

    const status = isRevision ? '🔄 Options Updated' : '✅ Design Options Ready';
    const typeEmoji = itemType === 'bug' ? '🐛' : '✨';
    const typeLabel = itemType === 'bug' ? 'Bug' : 'Feature';

    // Generate decision URL with token
    const token = generateDecisionToken(issueNumber);
    const decisionUrl = `${getAppUrl()}/decision/${issueNumber}?token=${token}`;

    // Truncate summary for Telegram (max 2800 chars to leave room for header)
    const truncatedSummary = summary.length > 2800
        ? summary.slice(0, 2800) + '...'
        : summary;

    const previewNote = previewUrl
        ? `\n🌐 <a href="${escapeHtml(previewUrl)}">Preview Deployment</a> (may take a few moments to be ready)`
        : '';

    const message = `<b>Agent (${escapeHtml(phase)}):</b> ${status}
${typeEmoji} ${typeLabel}

📋 ${escapeHtml(title)}
🔗 Issue #${issueNumber}
📊 Options: ${optionsCount}${previewNote}

<b>Summary:</b>
${escapeHtml(truncatedSummary)}`;

    const buttonRows: InlineButton[][] = [
        [
            { text: '✅ Choose Recommended', callback_data: `chooserec:${issueNumber}` },
        ],
        [
            { text: '🔧 All Options', url: decisionUrl },
        ],
    ];

    if (previewUrl) {
        buttonRows.push([
            { text: '🌐 Preview Mocks', url: previewUrl },
        ]);
    }

    buttonRows.push([
        { text: '📋 View Issue', url: issueUrl },
    ]);
    buttonRows.push([
        { text: '📝 Request Changes', callback_data: `changes:${issueNumber}` },
    ]);

    const buttons: InlineKeyboardMarkup = {
        inline_keyboard: buttonRows,
    };

    return sendToAdmin(message, buttons);
}
