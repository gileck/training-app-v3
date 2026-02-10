/**
 * Workflow Action Handler
 *
 * Single handler dispatching workflow actions to the workflow-service layer.
 * Supports: design review, request changes on PR, clarification received,
 * choose recommended, and mark done.
 */

import { ApiHandlerContext } from '@/apis/types';
import {
    reviewDesign,
    markClarificationReceived,
    requestChangesOnPR,
    markDone,
    mergeDesignPR,
    mergeImplementationPR,
    mergeFinalPR,
    revertMerge,
    mergeRevertPR,
    undoStatusChange,
} from '@/server/workflow-service';
import type { DesignType } from '@/server/workflow-service/merge-design-pr';
import { generateDecisionToken } from '@/apis/template/agent-decision/utils';
import { submitDecision } from '@/apis/template/agent-decision/handlers/submitDecision';
import type { WorkflowActionRequest, WorkflowActionResponse } from '../types';

export async function workflowAction(
    params: WorkflowActionRequest,
    context: ApiHandlerContext
): Promise<WorkflowActionResponse> {
    if (!context.isAdmin) {
        return { error: 'Admin access required' };
    }

    const { action, issueNumber } = params;

    if (!action || !issueNumber) {
        return { error: 'Missing required fields: action and issueNumber' };
    }

    try {
        switch (action) {
            case 'review-approve': {
                const result = await reviewDesign(issueNumber, 'approve');
                if (!result.success) return { error: result.error };
                return {
                    success: true,
                    message: result.advancedTo
                        ? `Approved — advanced to ${result.advancedTo}`
                        : 'Approved',
                };
            }
            case 'review-changes': {
                const result = await reviewDesign(issueNumber, 'changes');
                if (!result.success) return { error: result.error };
                return { success: true, message: 'Changes requested' };
            }
            case 'review-reject': {
                const result = await reviewDesign(issueNumber, 'reject');
                if (!result.success) return { error: result.error };
                return { success: true, message: 'Rejected' };
            }
            case 'request-changes-pr': {
                const result = await requestChangesOnPR(issueNumber);
                if (!result.success) return { error: result.error };
                return { success: true, message: 'Changes requested on PR' };
            }
            case 'clarification-received': {
                const result = await markClarificationReceived(issueNumber);
                if (!result.success) return { error: result.error };
                return { success: true, message: 'Clarification received' };
            }
            case 'choose-recommended': {
                const token = generateDecisionToken(issueNumber);
                const result = await submitDecision({
                    issueNumber,
                    token,
                    selection: { chooseRecommended: true },
                });
                if (!result.success) return { error: result.error };
                const detail = result.routedTo ? ` — routed to ${result.routedTo}` : '';
                return { success: true, message: `Recommended option selected${detail}` };
            }
            case 'mark-done': {
                const result = await markDone(issueNumber, {
                    logAction: 'manual_done',
                    logDescription: 'Marked as Done via UI',
                });
                if (!result.success) return { error: result.error };
                return { success: true, message: 'Marked as Done' };
            }
            case 'merge-design-pr': {
                if (!params.prNumber || !params.designType) return { error: 'Missing prNumber or designType' };
                const result = await mergeDesignPR(issueNumber, params.prNumber, params.designType as DesignType);
                if (!result.success) return { error: result.error };
                return { success: true, message: result.advancedTo ? `Merged — advanced to ${result.advancedTo}` : 'Design PR merged' };
            }
            case 'merge-pr': {
                const result = await mergeImplementationPR(issueNumber);
                if (!result.success) return { error: result.error };
                const msg = result.finalPrCreated
                    ? `Merged — final PR #${result.finalPrCreated.prNumber} created`
                    : result.phaseInfo?.next
                        ? `Merged — starting Phase ${result.phaseInfo.next}/${result.phaseInfo.total}`
                        : 'Merged — marked as Done';
                return { success: true, message: msg };
            }
            case 'merge-final-pr': {
                if (!params.prNumber) return { error: 'Missing prNumber' };
                const result = await mergeFinalPR(issueNumber, params.prNumber);
                if (!result.success) return { error: result.error };
                return { success: true, message: 'Final PR merged — feature complete!' };
            }
            case 'revert-pr': {
                if (!params.prNumber) return { error: 'Missing prNumber' };
                const result = await revertMerge(issueNumber, params.prNumber, undefined, params.phase);
                if (!result.success) return { error: result.error };
                return { success: true, message: `Revert PR #${result.revertPrNumber} created` };
            }
            case 'merge-revert-pr': {
                if (!params.prNumber) return { error: 'Missing prNumber' };
                const result = await mergeRevertPR(issueNumber, params.prNumber);
                if (!result.success) return { error: result.error };
                return { success: true, message: 'Revert PR merged — changes reverted' };
            }
            case 'undo-action': {
                if (!params.originalAction || !params.timestamp) {
                    return { error: 'Missing originalAction or timestamp' };
                }
                // Map original action to restore params
                const restoreStatus = params.originalAction === 'request-changes-pr' ? 'PR Review' : null;
                const result = await undoStatusChange(
                    issueNumber,
                    restoreStatus,
                    null, // clear review status
                    {
                        timestamp: params.timestamp,
                        logAction: `undo_${params.originalAction}`,
                        logDescription: `Undid ${params.originalAction} via UI`,
                    }
                );
                if (!result.success) return { error: result.error };
                return { success: true, message: 'Action undone' };
            }
            default:
                return { error: `Unknown action: ${action}` };
        }
    } catch (error) {
        console.error(`[workflow-action] Error executing ${action} for issue #${issueNumber}:`, error);
        return {
            error: error instanceof Error ? error.message : 'Failed to execute action',
        };
    }
}
