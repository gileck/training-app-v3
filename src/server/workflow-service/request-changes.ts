/**
 * Workflow Service — Request Changes on PR
 *
 * Handles requesting changes on an implementation PR.
 * Extracted from Telegram handler so both Telegram and UI
 * share the same code path.
 */

import { STATUSES, REVIEW_STATUSES } from '@/server/project-management/config';
import { findItemByIssueNumber } from './utils';
import { advanceStatus } from './advance';
import { updateReviewStatus } from './review-status';
import type { ServiceResult } from './types';

/**
 * Request changes on an implementation PR.
 *
 * 1. Validates item exists
 * 2. Sets status to Implementation (Ready for development)
 * 3. Sets review status to "Request Changes"
 */
export async function requestChangesOnPR(
    issueNumber: number
): Promise<ServiceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    // Set status to Implementation + review status to Request Changes
    await advanceStatus(issueNumber, STATUSES.implementation, {
        clearReview: false,
        logAction: 'implementation_changes_requested',
        logDescription: 'Changes requested on PR',
        logMetadata: { status: STATUSES.implementation, reviewStatus: REVIEW_STATUSES.requestChanges },
    });

    await updateReviewStatus(issueNumber, REVIEW_STATUSES.requestChanges);

    return { success: true, itemId: item.itemId };
}
