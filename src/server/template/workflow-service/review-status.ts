/**
 * Workflow Service — Review Status
 *
 * Manages review status transitions on GitHub Projects items.
 */

import {
    logWebhookAction,
    logExists,
} from '@/agents/lib/logging';
import { getInitializedAdapter, findItemByIssueNumber } from './utils';
import type { ServiceResult, ServiceOptions } from './types';

/**
 * Update the review status of a workflow item by issue number.
 *
 * 1. Finds the item in GitHub Projects
 * 2. Updates the review status via adapter
 * 3. Logs the action
 */
export async function updateReviewStatus(
    issueNumber: number,
    reviewStatus: string,
    options?: ServiceOptions
): Promise<ServiceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    const adapter = await getInitializedAdapter();

    if (adapter.hasReviewStatusField()) {
        await adapter.updateItemReviewStatus(item.itemId, reviewStatus);
    }

    if (options?.logAction && logExists(issueNumber)) {
        logWebhookAction(
            issueNumber,
            options.logAction,
            options.logDescription || `Review status updated to ${reviewStatus}`,
            { issueNumber, reviewStatus, ...options.logMetadata }
        );
    }

    return { success: true, itemId: item.itemId };
}

/**
 * Clear the review status of a workflow item (set to empty string).
 */
export async function clearReviewStatus(
    issueNumber: number,
    options?: ServiceOptions
): Promise<ServiceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    const adapter = await getInitializedAdapter();

    if (adapter.hasReviewStatusField() && item.reviewStatus) {
        await adapter.clearItemReviewStatus(item.itemId);
    }

    if (options?.logAction && logExists(issueNumber)) {
        logWebhookAction(
            issueNumber,
            options.logAction,
            options.logDescription || 'Review status cleared',
            { issueNumber, ...options.logMetadata }
        );
    }

    return { success: true, itemId: item.itemId };
}
