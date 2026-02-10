/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for undo operations
 */

import { STATUSES, COMMIT_MESSAGE_MARKER, getIssueUrl } from '@/server/project-management/config';
import { parseCommitMessageComment } from '@/agents/lib/commitMessage';
import { getCommitMessage } from '@/agents/lib/workflow-db';
import { sendNotificationToOwner } from '@/server/telegram';
import {
    logExternalError,
    logExists,
} from '@/agents/lib/logging';
import {
    undoStatusChange,
    findItemByIssueNumber,
} from '@/server/workflow-service';
import { editMessageText } from '../telegram-api';
import { escapeHtml } from '../utils';
import type { TelegramCallbackQuery, DesignType, HandlerResult } from '../types';

/**
 * Handle undo for implementation PR request changes
 * Callback format: "u_rc:issueNumber:prNumber:timestamp"
 */
export async function handleUndoRequestChanges(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number,
    timestamp: number
): Promise<HandlerResult> {
    try {
        // Check idempotency first
        const item = await findItemByIssueNumber(issueNumber);
        if (item && item.status === STATUSES.prReview && !item.reviewStatus) {
            console.log(`[LOG:UNDO] Undo already performed for PR #${prNumber}, issue #${issueNumber}`);
            return { success: true };
        }

        // Undo: restore to PR Review + clear review status
        const result = await undoStatusChange(
            issueNumber,
            STATUSES.prReview,
            null, // clear review status
            {
                timestamp,
                logAction: 'undo_request_changes',
                logDescription: `Undid request changes for PR #${prNumber}`,
                logMetadata: { prNumber, restoredStatus: STATUSES.prReview },
            }
        );

        if (!result.success) {
            if (result.expired) {
                console.warn(`[LOG:UNDO] Undo window expired for PR #${prNumber}, issue #${issueNumber}`);
            }
            return { success: false, error: result.error };
        }

        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const cleanedText = originalText
                .replace(/\n*<i>Changed your mind\?.*<\/i>/g, '')
                .replace(/\n*Changed your mind\?.*5 minutes\./g, '');

            const undoConfirmation = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '↩️ <b>Undone!</b>',
                '',
                `📊 Status restored to: ${STATUSES.prReview}`,
                '📋 Review Status: (cleared)',
                '',
                'Re-sending PR Ready notification...',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(cleanedText) + undoConfirmation,
                'HTML'
            );
        }

        // Re-send the PR Ready notification
        const { Octokit } = await import('@octokit/rest');
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        const { getProjectConfig } = await import('@/server/project-management/config');
        const projectConfig = getProjectConfig();
        const { owner, repo } = projectConfig.github;

        const { data: pr } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        const { data: comments } = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: prNumber,
        });

        // Try DB first for commit message
        let commitMessage = await getCommitMessage(issueNumber, prNumber);

        // Fallback to PR comment parsing
        if (!commitMessage) {
            commitMessage = { title: pr.title, body: pr.body || '' };
            for (const comment of comments) {
                if (comment.body?.includes(COMMIT_MESSAGE_MARKER)) {
                    const parsed = parseCommitMessageComment(comment.body);
                    if (parsed) {
                        commitMessage = parsed;
                        break;
                    }
                }
            }
        }

        // Re-fetch item for title (may have been refreshed)
        const currentItem = await findItemByIssueNumber(issueNumber);

        const { notifyPRReadyToMerge } = await import('@/agents/shared/notifications');
        await notifyPRReadyToMerge(
            currentItem?.title || item?.title || `Issue #${issueNumber}`,
            issueNumber,
            prNumber,
            commitMessage,
            'feature'
        );

        console.log(`Telegram webhook: undid request changes for PR #${prNumber}, issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error(`[LOG:UNDO] Error handling undo request changes for PR #${prNumber}, issue #${issueNumber}:`, error);
        if (logExists(issueNumber)) {
            logExternalError(issueNumber, 'telegram', error instanceof Error ? error : new Error(String(error)));
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle undo for design PR request changes
 * Callback format: "u_dc:prNumber:issueNumber:designType:timestamp"
 */
export async function handleUndoDesignChanges(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    prNumber: number,
    issueNumber: number,
    designType: DesignType,
    timestamp: number
): Promise<HandlerResult> {
    try {
        // Check idempotency first
        const item = await findItemByIssueNumber(issueNumber);
        if (item && !item.reviewStatus) {
            console.log(`[LOG:UNDO] Undo already performed for design PR #${prNumber}, issue #${issueNumber}`);
            return { success: true };
        }

        // Undo: just clear review status (don't change main status)
        const result = await undoStatusChange(
            issueNumber,
            null, // don't change status
            null, // clear review status
            {
                timestamp,
                logAction: 'undo_design_changes',
                logDescription: `Undid request changes for ${designType === 'product-dev' ? 'Product Development' : designType === 'product' ? 'Product Design' : 'Technical Design'} PR #${prNumber}`,
                logMetadata: { prNumber, designType },
            }
        );

        if (!result.success) {
            if (result.expired) {
                console.warn(`[LOG:UNDO] Undo window expired for design PR #${prNumber}, issue #${issueNumber}`);
            }
            return { success: false, error: result.error };
        }

        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const cleanedText = originalText
                .replace(/\n*<i>Changed your mind\?.*<\/i>/g, '')
                .replace(/\n*Changed your mind\?.*5 minutes\./g, '');

            const undoConfirmation = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '↩️ <b>Undone!</b>',
                '',
                `📊 Status: ${item?.status}`,
                '📋 Review Status: (cleared)',
                '',
                'Re-sending Design PR Ready notification...',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(cleanedText) + undoConfirmation,
                'HTML'
            );
        }

        const { notifyDesignPRReady } = await import('@/agents/shared/notifications');
        await notifyDesignPRReady(
            designType,
            item?.title || `Issue #${issueNumber}`,
            issueNumber,
            prNumber,
            false,
            'feature'
        );

        console.log(`Telegram webhook: undid design changes for ${designType} PR #${prNumber}, issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error(`[LOG:UNDO] Error handling undo design changes for PR #${prNumber}, issue #${issueNumber}:`, error);
        if (logExists(issueNumber)) {
            logExternalError(issueNumber, 'telegram', error instanceof Error ? error : new Error(String(error)));
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Handle undo for design review (changes/reject)
 * Callback format: "u_dr:issueNumber:action:previousStatus:timestamp"
 */
export async function handleUndoDesignReview(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    originalAction: 'changes' | 'reject',
    _previousStatus: string,
    timestamp: number
): Promise<HandlerResult> {
    try {
        // Check idempotency first
        const item = await findItemByIssueNumber(issueNumber);
        if (item && !item.reviewStatus) {
            console.log(`[LOG:UNDO] Undo already performed for design review, issue #${issueNumber}`);
            return { success: true };
        }

        // Undo: just clear review status
        const result = await undoStatusChange(
            issueNumber,
            null, // don't change status
            null, // clear review status
            {
                timestamp,
                logAction: 'undo_design_review',
                logDescription: `Undid ${originalAction} for design review`,
                logMetadata: { originalAction, status: item?.status },
            }
        );

        if (!result.success) {
            if (result.expired) {
                console.warn(`[LOG:UNDO] Undo window expired for design review, issue #${issueNumber}`);
            }
            return { success: false, error: result.error };
        }

        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const cleanedText = originalText
                .replace(/\n*<i>Changed your mind\?.*<\/i>/g, '')
                .replace(/\n*Changed your mind\?.*5 minutes\./g, '');

            const undoConfirmation = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '↩️ <b>Undone!</b>',
                '',
                `📊 Status: ${item?.status}`,
                '📋 Review Status: (cleared)',
                '',
                'Re-sending review notification...',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(cleanedText) + undoConfirmation,
                'HTML'
            );
        }

        const issueUrl = getIssueUrl(issueNumber);

        await sendNotificationToOwner(
            `<b>🔄 Review Restored</b>\n\n📋 ${escapeHtml(item?.title || `Issue #${issueNumber}`)}\n🔗 Issue #${issueNumber}\n📊 Status: ${item?.status}\n\nReady for review again.`,
            {
                parseMode: 'HTML',
                inlineKeyboard: [
                    [
                        { text: '📋 View Issue', url: issueUrl },
                    ],
                    [
                        { text: '✅ Approve', callback_data: `approve:${issueNumber}` },
                        { text: '📝 Request Changes', callback_data: `changes:${issueNumber}` },
                        { text: '❌ Reject', callback_data: `reject:${issueNumber}` },
                    ],
                ],
            }
        );

        console.log(`Telegram webhook: undid ${originalAction} for issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error(`[LOG:UNDO] Error handling undo design review for issue #${issueNumber}:`, error);
        if (logExists(issueNumber)) {
            logExternalError(issueNumber, 'telegram', error instanceof Error ? error : new Error(String(error)));
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
