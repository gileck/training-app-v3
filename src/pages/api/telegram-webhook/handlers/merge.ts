/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for PR merge operations
 *
 * Thin wrappers around workflow-service functions.
 * Each handler delegates business logic to the service layer
 * and handles only Telegram-specific message editing.
 */

import { getIssueUrl, getPrUrl } from '@/server/template/project-management/config';
import { sendNotificationToOwner } from '@/server/template/telegram';
import { appConfig } from '@/app.config';
import {
    logExternalError,
    logExists,
} from '@/agents/lib/logging';
import {
    mergeImplementationPR,
    mergeFinalPR,
    revertMerge,
    mergeRevertPR,
    getInitializedAdapter,
} from '@/server/template/workflow-service';
import { editMessageText } from '../telegram-api';
import { escapeHtml } from '../utils';
import type { TelegramCallbackQuery, HandlerResult } from '../types';

/**
 * Handle merge final PR callback from Telegram (feature branch workflow)
 * Callback format: "merge_final:issueNumber:prNumber"
 *
 * Delegates business logic to workflow-service/merge-final-pr.
 */
export async function handleMergeFinalPRCallback(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number
): Promise<HandlerResult> {
    try {
        const result = await mergeFinalPR(issueNumber, prNumber);
        if (!result.success) {
            return { success: false, error: result.error };
        }

        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Final PR Merged Successfully!</b>',
                `PR #${prNumber} merged to main.`,
                '🎉 Feature is now complete!',
                '📊 Status: Done',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                'HTML'
            );
        }

        return { success: true };
    } catch (error) {
        console.error('Error handling final PR merge:', error);
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
 * Handle merge callback from Telegram
 * Callback format: "merge:issueNumber:prNumber"
 *
 * Delegates business logic to workflow-service/merge-pr.
 */
export async function handleMergeCallback(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number
): Promise<HandlerResult> {
    try {
        const result = await mergeImplementationPR(issueNumber, prNumber);
        if (!result.success) {
            return { success: false, error: result.error };
        }

        // Build status message for Telegram
        let statusMessage = '';
        if (result.phaseInfo?.next) {
            statusMessage = `📋 Phase ${result.phaseInfo.current}/${result.phaseInfo.total} complete\n🔄 Starting Phase ${result.phaseInfo.next}/${result.phaseInfo.total}`;
        } else if (result.finalPrCreated) {
            statusMessage = `🚀 All ${result.phaseInfo?.total || 0} phases complete!\n📋 Final PR #${result.finalPrCreated.prNumber} created\n📊 Status: Final Review`;
        } else if (result.phaseInfo) {
            statusMessage = `🎉 All ${result.phaseInfo.total} phases complete!\n📊 Status: Done`;
        } else {
            statusMessage = '📊 Status: Done';
        }

        // Edit original Telegram message
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Merged Successfully!</b>',
                `PR #${prNumber} has been squash-merged.`,
                statusMessage,
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                'HTML'
            );
        }

        // Send multi-phase middle notification
        if (result.phaseInfo?.next && appConfig.ownerTelegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const message = `<b>Agent (Multi-PR):</b> ✅ Phase ${result.phaseInfo.current}/${result.phaseInfo.total} merged

🔗 Issue #${issueNumber}
🔀 PR #${prNumber}

Starting Phase ${result.phaseInfo.next}/${result.phaseInfo.total}...
Run <code>yarn agent:implement</code> to continue.`;

            await sendNotificationToOwner(message, {
                parseMode: 'HTML',
            });
        }

        // Send final PR notification
        if (result.finalPrCreated && appConfig.ownerTelegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const adapter = await getInitializedAdapter();
            const issueDetails = await adapter.getIssueDetails(issueNumber);
            const issueTitle = issueDetails?.title || `Issue #${issueNumber}`;

            const finalReviewMessage = [
                '🚀 <b>All Phases Complete - Final Review</b>',
                '',
                `📋 Issue: <b>${escapeHtml(issueTitle)}</b>`,
                `🔗 Issue #${issueNumber}`,
                '',
                `✅ All ${result.phaseInfo?.total || 0} phases have been merged to the feature branch.`,
                `📋 Final PR: #${result.finalPrCreated.prNumber}`,
                '',
                '🔍 <b>Please verify the complete feature via Vercel preview before merging.</b>',
            ].join('\n');

            const mergeFinalCallback = `merge_final:${issueNumber}:${result.finalPrCreated.prNumber}`;

            await sendNotificationToOwner(finalReviewMessage, {
                parseMode: 'HTML',
                inlineKeyboard: [
                    [
                        { text: '✅ Merge Final PR', callback_data: mergeFinalCallback },
                        { text: '🔗 View PR', url: result.finalPrCreated.prUrl },
                    ],
                ],
            });
        }

        // Send merge success notification with revert button
        if (result.mergeCommitSha && appConfig.ownerTelegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
            const adapter = await getInitializedAdapter();
            const issueDetails = await adapter.getIssueDetails(issueNumber);
            const issueTitle = issueDetails?.title || `Issue #${issueNumber}`;
            const prInfo = await adapter.getPRInfo(prNumber);
            const prTitle = prInfo?.title || `PR #${prNumber}`;

            const isMultiPhaseMiddle = !!result.phaseInfo?.next || !!result.finalPrCreated;

            let progressMessage = '';
            if (result.phaseInfo?.next) {
                progressMessage = `📊 Progress: Phase ${result.phaseInfo.current} of ${result.phaseInfo.total} complete\n⏭️ Next: Phase ${result.phaseInfo.next}`;
            } else if (result.phaseInfo && result.phaseInfo.current === result.phaseInfo.total) {
                progressMessage = `🎉 All ${result.phaseInfo.total} phases complete! Feature ready.`;
            } else {
                progressMessage = `🎉 Implementation complete! Issue is now Done.`;
            }

            const prevStatus = isMultiPhaseMiddle ? 'prrev' : 'impl';
            const phaseStr = result.phaseInfo ? `${result.phaseInfo.current}/${result.phaseInfo.total}` : '';
            const shortSha = result.mergeCommitSha.slice(0, 7);
            const revertCallback = `rv:${issueNumber}:${prNumber}:${shortSha}:${prevStatus}:${phaseStr}`;

            const successMessage = [
                '✅ <b>PR Merged Successfully</b>',
                '',
                `📝 PR: #${prNumber} - ${escapeHtml(prTitle)}`,
                `🔗 Issue: #${issueNumber} - ${escapeHtml(issueTitle)}`,
                '',
                progressMessage,
            ].join('\n');

            await sendNotificationToOwner(successMessage, {
                parseMode: 'HTML',
                inlineKeyboard: [
                    [
                        { text: '📄 View PR', url: getPrUrl(prNumber) },
                        { text: '📋 View Issue', url: getIssueUrl(issueNumber) },
                    ],
                    [
                        { text: '↩️ Revert', callback_data: revertCallback },
                    ],
                ],
            });
        }

        return { success: true };
    } catch (error) {
        console.error(`[LOG:MERGE] Error handling merge for PR #${prNumber}, issue #${issueNumber}:`, error);
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
 * Handle revert merge callback
 * Callback format: "rv:issueNumber:prNumber:shortSha:prevStatus:phase"
 *
 * Delegates business logic to workflow-service/revert.
 */
export async function handleRevertMerge(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number,
    shortSha: string,
    _prevStatus: string,
    phase: string
): Promise<HandlerResult> {
    try {
        const result = await revertMerge(issueNumber, prNumber, shortSha, phase || undefined);
        if (!result.success) {
            return { success: false, error: result.error };
        }

        // Edit original message
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const revertNote = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '↩️ <b>Revert Initiated</b>',
                `Revert PR #${result.revertPrNumber} created`,
                '',
                `<a href="${result.revertPrUrl}">View Revert PR</a>`,
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + revertNote,
                'HTML'
            );
        }

        // Send revert confirmation notification
        const adapter = await getInitializedAdapter();
        const issueDetails = await adapter.getIssueDetails(issueNumber);
        const issueTitle = issueDetails?.title || `Issue #${issueNumber}`;

        const confirmMessage = [
            '↩️ <b>Merge Reverted</b>',
            '',
            `📋 Issue: #${issueNumber} - ${escapeHtml(issueTitle)}`,
            `🔀 Original PR: #${prNumber}`,
            `🔄 Revert PR: #${result.revertPrNumber}`,
            '',
            phase ? `📊 Status: Implementation (Phase ${phase})` : '📊 Status: Implementation',
            '📝 Review Status: Request Changes',
            '',
            '<b>Next steps:</b>',
            '1️⃣ Click "Merge Revert PR" below to undo the changes',
            `2️⃣ Go to Issue #${issueNumber} and add a comment explaining what went wrong`,
            '3️⃣ Run <code>yarn agent:implement</code> - the agent will read your feedback and create a new PR',
        ].join('\n');

        const mergeRevertCallback = `merge_rv:${issueNumber}:${result.revertPrNumber}`;

        await sendNotificationToOwner(confirmMessage, {
            parseMode: 'HTML',
            inlineKeyboard: [
                [
                    { text: '✅ Merge Revert PR', callback_data: mergeRevertCallback },
                ],
                [
                    { text: '📄 View Revert PR', url: result.revertPrUrl || getPrUrl(result.revertPrNumber!) },
                    { text: '📋 View Issue', url: getIssueUrl(issueNumber) },
                ],
            ],
        });

        return { success: true };
    } catch (error) {
        console.error(`[LOG:REVERT] Error handling revert for PR #${prNumber}, issue #${issueNumber}:`, error);
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
 * Handle merge revert PR callback
 * Callback format: "merge_rv:issueNumber:revertPrNumber"
 *
 * Delegates business logic to workflow-service/revert.
 */
export async function handleMergeRevertPR(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    revertPrNumber: number
): Promise<HandlerResult> {
    try {
        const result = await mergeRevertPR(issueNumber, revertPrNumber);
        if (!result.success) {
            return { success: false, error: result.error };
        }

        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const mergedNote = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Revert PR Merged</b>',
                'Changes have been reverted on main.',
                '',
                '<b>Next steps:</b>',
                `1️⃣ Go to Issue #${issueNumber} and add a comment explaining what went wrong`,
                '2️⃣ Run <code>yarn agent:implement</code> - the agent will read your feedback and create a new PR',
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + mergedNote,
                'HTML'
            );
        }

        return { success: true };
    } catch (error) {
        console.error(`[LOG:REVERT] Error merging revert PR #${revertPrNumber} for issue #${issueNumber}:`, error);
        if (logExists(issueNumber)) {
            logExternalError(issueNumber, 'telegram', error instanceof Error ? error : new Error(String(error)));
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
