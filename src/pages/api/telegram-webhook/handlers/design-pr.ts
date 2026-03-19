/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for design PR operations (approve/request changes)
 */

import { STATUSES, REVIEW_STATUSES, getPrUrl } from '@/server/template/project-management/config';
import {
    logExternalError,
    logExists,
} from '@/agents/lib/logging';
import {
    approveDesign,
    requestChangesOnDesignPR,
} from '@/server/template/workflow-service';
import { editMessageText, editMessageWithUndoButton } from '../telegram-api';
import { escapeHtml } from '../utils';
import type { TelegramCallbackQuery, DesignType, HandlerResult } from '../types';

const DESIGN_TYPE_LABELS: Record<DesignType, string> = {
    'product-dev': 'Product Development',
    'product': 'Product Design',
    'tech': 'Technical Design',
};

const NEXT_PHASE_LABELS: Record<DesignType, string> = {
    'product-dev': 'Product Design',
    'product': 'Tech Design',
    'tech': 'Implementation',
};

/**
 * Handle design PR approval callback
 * Callback format: "design_approve:prNumber:issueNumber:type"
 *
 * Delegates business logic to workflow-service/merge-design-pr.
 */
export async function handleDesignPRApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    prNumber: number,
    issueNumber: number,
    designType: DesignType
): Promise<HandlerResult> {
    try {
        const result = await approveDesign(issueNumber, prNumber, designType);
        if (!result.success) {
            return { success: false, error: result.error };
        }

        const designLabel = DESIGN_TYPE_LABELS[designType];
        const nextPhaseLabel = NEXT_PHASE_LABELS[designType];

        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '✅ <b>Approved Successfully!</b>',
                `${designLabel} design approved.`,
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
        const result = await requestChangesOnDesignPR(issueNumber, prNumber, DESIGN_TYPE_LABELS[designType]);
        if (!result.success) {
            return { success: false, error: result.error };
        }

        const designLabel = DESIGN_TYPE_LABELS[designType];

        const prUrl = getPrUrl(prNumber);
        const timestamp = Date.now();
        if (callbackQuery.message) {
            const originalText = callbackQuery.message.text || '';
            const statusUpdate = [
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                '🔄 <b>Changes Requested</b>',
                '',
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
 *
 * Delegates business logic to workflow-service/request-changes.
 */
export async function handleRequestChangesCallback(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    issueNumber: number,
    prNumber: number
): Promise<HandlerResult> {
    try {
        const { requestChangesOnPR } = await import('@/server/template/workflow-service');
        const result = await requestChangesOnPR(issueNumber);

        if (!result.success) {
            return { success: false, error: result.error };
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
