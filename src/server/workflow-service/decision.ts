/**
 * Workflow Service — Decision Routing
 *
 * Routes items based on admin decision selection (bug fix approach, etc.).
 */

import {
    logWebhookAction,
    logExists,
} from '@/agents/lib/logging';
import { getInitializedAdapter, findItemByIssueNumber, syncWorkflowStatus } from './utils';
import type { ServiceResult, ServiceOptions } from './types';

/**
 * Route an item based on an admin decision.
 *
 * When a routing config is present and a target status is determined:
 *   - Updates the item status to the target
 *   - Clears the review status
 *   - Syncs to DB
 *
 * When no routing (just approval):
 *   - Sets review status to the provided value (typically "Approved")
 */
export async function submitDecisionRouting(
    issueNumber: number,
    targetStatus: string | undefined,
    options?: ServiceOptions & { reviewStatus?: string }
): Promise<ServiceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    const adapter = await getInitializedAdapter();

    if (targetStatus) {
        // Route to target status and clear review
        await adapter.updateItemStatus(item.itemId, targetStatus);

        if (adapter.hasReviewStatusField()) {
            await adapter.updateItemReviewStatus(item.itemId, '');
        }

        await syncWorkflowStatus(issueNumber, targetStatus);

        if (logExists(issueNumber)) {
            logWebhookAction(
                issueNumber,
                options?.logAction || 'decision_routed',
                options?.logDescription || `Decision routed to ${targetStatus}`,
                { issueNumber, targetStatus, ...options?.logMetadata }
            );
        }
    } else if (options?.reviewStatus) {
        // No routing — set review status (e.g., Approved)
        if (adapter.hasReviewStatusField()) {
            await adapter.updateItemReviewStatus(item.itemId, options.reviewStatus);
        }

        if (logExists(issueNumber)) {
            logWebhookAction(
                issueNumber,
                options?.logAction || 'decision_approved',
                options?.logDescription || `Review status set to ${options.reviewStatus}`,
                { issueNumber, reviewStatus: options.reviewStatus, ...options?.logMetadata }
            );
        }
    }

    return { success: true, itemId: item.itemId };
}
