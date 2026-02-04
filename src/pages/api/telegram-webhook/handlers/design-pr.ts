/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for design PR operations (approve/request changes)
 */

import { getProjectManagementAdapter } from '@/server/project-management';
import { STATUSES, REVIEW_STATUSES, getPrUrl } from '@/server/project-management/config';
import { readDesignDoc } from '@/agents/lib/design-files';
import { formatPhasesToComment, parsePhasesFromMarkdown, hasPhaseComment } from '@/agents/lib/phases';
import {
    initializeImplementationPhases,
    updateDesignArtifact,
    getDesignDocLink,
} from '@/agents/lib';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExternalError,
    logExists,
} from '@/agents/lib/logging';
import { editMessageText, editMessageWithUndoButton } from '../telegram-api';
import { escapeHtml, findItemByIssueNumber } from '../utils';
import type { TelegramCallbackQuery, DesignType, HandlerResult } from '../types';

/**
 * Handle design PR approval callback
 * Callback format: "design_approve:prNumber:issueNumber:type"
 */
export async function handleDesignPRApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    prNumber: number,
    issueNumber: number,
    designType: DesignType
): Promise<HandlerResult> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        const designLabel = designType === 'product-dev'
            ? 'Product Development'
            : designType === 'product'
                ? 'Product Design'
                : 'Technical Design';

        if (logExists(issueNumber)) {
            logWebhookPhaseStart(issueNumber, `${designLabel} PR Merge`, 'telegram');
        }

        const docType = designType === 'product-dev' ? 'product development' : designType;
        const commitTitle = `docs: ${docType} for issue #${issueNumber}`;
        const commitBody = `Approved ${docType} document.\n\nPart of #${issueNumber}`;

        await adapter.mergePullRequest(prNumber, commitTitle, commitBody);

        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'design_pr_merged', `${designLabel} PR #${prNumber} merged`, {
                prNumber,
                designType,
                commitTitle,
            });
        }

        if (designType !== 'product-dev') {
            const isProductDesign = designType === 'product';
            await updateDesignArtifact(adapter, issueNumber, {
                type: isProductDesign ? 'product-design' : 'tech-design',
                path: getDesignDocLink(issueNumber, designType),
                status: 'approved',
                lastUpdated: new Date().toISOString().split('T')[0],
                prNumber,
            });
            console.log(`Telegram webhook: updated design artifact for issue #${issueNumber}`);
        }

        const nextPhase = designType === 'product-dev'
            ? STATUSES.productDesign
            : designType === 'product'
                ? STATUSES.techDesign
                : STATUSES.implementation;
        const nextPhaseLabel = designType === 'product-dev'
            ? 'Product Design'
            : designType === 'product'
                ? 'Tech Design'
                : 'Implementation';

        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (item) {
            await adapter.updateItemStatus(item.itemId, nextPhase);
            console.log(`Telegram webhook: advanced status to ${nextPhase}`);

            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'status_advanced', `Status advanced to ${nextPhaseLabel}`, {
                    from: item.status,
                    to: nextPhase,
                });
            }

            if (adapter.hasReviewStatusField() && item.reviewStatus) {
                await adapter.clearItemReviewStatus(item.itemId);
                console.log(`Telegram webhook: cleared review status`);
            }

            const prDetails = await adapter.getPRDetails(prNumber);
            if (prDetails?.headBranch) {
                await adapter.deleteBranch(prDetails.headBranch);
                console.log(`Telegram webhook: deleted branch ${prDetails.headBranch}`);
                if (logExists(issueNumber)) {
                    logWebhookAction(issueNumber, 'branch_deleted', `Branch ${prDetails.headBranch} deleted`, {
                        branch: prDetails.headBranch,
                    });
                }
            }

            if (designType === 'tech') {
                const techDesign = readDesignDoc(issueNumber, 'tech');
                if (techDesign) {
                    const phases = parsePhasesFromMarkdown(techDesign);
                    if (phases && phases.length >= 2) {
                        const issueComments = await adapter.getIssueComments(issueNumber);
                        if (!hasPhaseComment(issueComments)) {
                            const phasesComment = formatPhasesToComment(phases);
                            await adapter.addIssueComment(issueNumber, phasesComment);
                            console.log(`Telegram webhook: posted phases comment (${phases.length} phases)`);
                        }

                        await initializeImplementationPhases(
                            adapter,
                            issueNumber,
                            phases.map(p => ({ order: p.order, name: p.name }))
                        );
                        console.log(`Telegram webhook: initialized implementation phases`);

                        if (logExists(issueNumber)) {
                            logWebhookAction(issueNumber, 'phases_initialized', `Initialized ${phases.length} implementation phases`, {
                                phases: phases.map(p => ({ order: p.order, name: p.name })),
                            });
                        }
                    }
                }
            }
        } else {
            console.warn(`Telegram webhook: project item not found for issue #${issueNumber}`);
        }

        if (logExists(issueNumber)) {
            logWebhookPhaseEnd(issueNumber, `${designLabel} PR Merge`, 'success', 'telegram');
        }

        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Merged Successfully!</b>',
                `${designLabel} PR #${prNumber} merged.`,
                `📊 Status: ${nextPhaseLabel}`,
            ].join('\n');

            await editMessageText(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                'HTML'
            );
        }

        console.log(`Telegram webhook: merged ${designType} design PR #${prNumber} for issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error(`[LOG:DESIGN_PR] Error handling design PR #${prNumber} approval for issue #${issueNumber}:`, error);
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
 * Handle design PR request changes callback
 * Callback format: "design_changes:prNumber:issueNumber:type"
 */
export async function handleDesignPRRequestChanges(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    prNumber: number,
    issueNumber: number,
    designType: DesignType
): Promise<HandlerResult> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (!item) {
            console.warn(`[LOG:DESIGN_PR] Issue #${issueNumber} not found in project for request changes`);
            return { success: false, error: `Issue #${issueNumber} not found in project.` };
        }

        await adapter.updateItemReviewStatus(item.itemId, REVIEW_STATUSES.requestChanges);

        const designLabel = designType === 'product-dev'
            ? 'Product Development'
            : designType === 'product'
                ? 'Product Design'
                : 'Technical Design';

        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'design_changes_requested', `Changes requested on ${designLabel} PR #${prNumber}`, {
                prNumber,
                designType,
                reviewStatus: REVIEW_STATUSES.requestChanges,
            });
        }

        const prUrl = getPrUrl(prNumber);
        const timestamp = Date.now();
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '🔄 <b>Changes Requested</b>',
                '',
                `📊 Status: ${item.status}`,
                `📋 Review Status: ${REVIEW_STATUSES.requestChanges}`,
                '',
                `<b>Next:</b> <a href="${prUrl}">Comment on the ${designLabel} PR</a> explaining what needs to change.`,
                'Design agent will revise on next run.',
                '',
                '<i>Changed your mind? Click Undo within 5 minutes.</i>',
            ].join('\n');

            const undoCallback = `u_dc:${prNumber}:${issueNumber}:${designType}:${timestamp}`;
            await editMessageWithUndoButton(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                undoCallback,
                timestamp
            );
        }

        console.log(`Telegram webhook: requested changes for ${designType} design PR #${prNumber}, issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error(`[LOG:DESIGN_PR] Error handling design PR #${prNumber} request changes for issue #${issueNumber}:`, error);
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
 * Handle request changes callback from Telegram (admin requests changes after PR approval)
 * Callback format: "reqchanges:issueNumber:prNumber"
 */
export async function handleRequestChangesCallback(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number
): Promise<HandlerResult> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        const item = await findItemByIssueNumber(adapter, issueNumber);
        if (!item) {
            console.warn(`[LOG:DESIGN_PR] Issue #${issueNumber} not found in project for implementation changes`);
            return { success: false, error: `Issue #${issueNumber} not found in project.` };
        }

        await adapter.updateItemStatus(item.itemId, STATUSES.implementation);
        await adapter.updateItemReviewStatus(item.itemId, REVIEW_STATUSES.requestChanges);

        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'implementation_changes_requested', `Changes requested on PR #${prNumber}`, {
                prNumber,
                status: STATUSES.implementation,
                reviewStatus: REVIEW_STATUSES.requestChanges,
            });
        }

        const prUrl = getPrUrl(prNumber);
        const timestamp = Date.now();
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '🔄 <b>Marked for Changes</b>',
                '',
                `📊 Status: ${STATUSES.implementation}`,
                `📋 Review Status: ${REVIEW_STATUSES.requestChanges}`,
                '',
                `<b>Next:</b> <a href="${prUrl}">Comment on the PR</a> explaining what needs to change.`,
                'Implementor will pick it up on next run.',
                '',
                '<i>Changed your mind? Click Undo within 5 minutes.</i>',
            ].join('\n');

            const undoCallback = `u_rc:${issueNumber}:${prNumber}:${timestamp}`;
            await editMessageWithUndoButton(
                botToken,
                callbackQuery.message.chat.id,
                callbackQuery.message.message_id,
                escapeHtml(originalText) + statusUpdate,
                undoCallback,
                timestamp
            );
        }

        console.log(`Telegram webhook: requested changes for PR #${prNumber}, issue #${issueNumber}`);
        return { success: true };
    } catch (error) {
        console.error(`[LOG:DESIGN_PR] Error handling request changes for PR #${prNumber}, issue #${issueNumber}:`, error);
        if (logExists(issueNumber)) {
            logExternalError(issueNumber, 'telegram', error instanceof Error ? error : new Error(String(error)));
        }
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
