/**
 * Workflow Service — Agent Completion
 *
 * Called by agents when they finish their work to update status/review.
 */

import {
    logWebhookAction,
    logExists,
} from '@/agents/lib/logging';
import { getInitializedAdapter, findItemByIssueNumber, syncWorkflowStatus } from './utils';
import type { ServiceResult, AgentCompletionResult } from './types';

/**
 * Complete an agent run by updating the item's status and/or review status.
 *
 * Agents call this when done to set the appropriate state for the next stage.
 *
 * @param issueNumber - The GitHub issue number
 * @param agentType - Agent identifier for logging (e.g., 'implementation', 'bug-investigation', 'pr-review')
 * @param result - What to set: status, reviewStatus, or clearReviewStatus
 */
export async function completeAgentRun(
    issueNumber: number,
    agentType: string,
    result: AgentCompletionResult
): Promise<ServiceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    const adapter = await getInitializedAdapter();

    // Update status if provided
    if (result.status) {
        await adapter.updateItemStatus(item.itemId, result.status);
        await syncWorkflowStatus(issueNumber, result.status);
    }

    // Handle review status
    if (result.clearReviewStatus) {
        if (adapter.hasReviewStatusField()) {
            await adapter.updateItemReviewStatus(item.itemId, '');
        }
    } else if (result.reviewStatus) {
        if (adapter.hasReviewStatusField()) {
            await adapter.updateItemReviewStatus(item.itemId, result.reviewStatus);
        }
    }

    // Log
    if (logExists(issueNumber)) {
        logWebhookAction(
            issueNumber,
            `agent_${agentType}_complete`,
            `Agent ${agentType} completed`,
            {
                issueNumber,
                agentType,
                newStatus: result.status,
                newReviewStatus: result.clearReviewStatus ? '(cleared)' : result.reviewStatus,
            }
        );
    }

    return { success: true, itemId: item.itemId };
}
