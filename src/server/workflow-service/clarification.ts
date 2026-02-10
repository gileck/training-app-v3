/**
 * Workflow Service — Clarification
 *
 * Handles "Clarification Received" action. Extracted from Telegram
 * handler so both Telegram and UI share the same code path.
 */

import { REVIEW_STATUSES } from '@/server/project-management/config';
import { findItemByIssueNumber } from './utils';
import { updateReviewStatus } from './review-status';
import type { ServiceResult } from './types';

/**
 * Mark an item's clarification as received.
 *
 * 1. Validates item exists
 * 2. Verifies item is waiting for clarification
 * 3. Updates review status to "Clarification Received"
 */
export async function markClarificationReceived(
    issueNumber: number
): Promise<ServiceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    if (item.reviewStatus !== REVIEW_STATUSES.waitingForClarification) {
        return {
            success: false,
            error: `Item is not waiting for clarification (current: ${item.reviewStatus || 'none'})`,
        };
    }

    await updateReviewStatus(issueNumber, REVIEW_STATUSES.clarificationReceived, {
        logAction: 'clarification_received',
        logDescription: 'Clarification received',
        logMetadata: { reviewStatus: REVIEW_STATUSES.clarificationReceived },
    });

    return { success: true, itemId: item.itemId };
}
