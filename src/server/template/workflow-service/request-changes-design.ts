/**
 * Workflow Service — Request Changes on Design PR
 *
 * Handles requesting changes on a design PR (product-dev, product, or tech design).
 * Extracted from Telegram handler so both Telegram and UI share the same code path.
 */

import { REVIEW_STATUSES } from '@/server/template/project-management/config';
import { findItemByIssueNumber, logHistory } from './utils';
import { updateReviewStatus } from './review-status';
import type { ServiceResult } from './types';

/**
 * Request changes on a design PR.
 *
 * 1. Validates item exists
 * 2. Sets review status to "Request Changes"
 */
export async function requestChangesOnDesignPR(
    issueNumber: number,
    prNumber: number,
    designType: string
): Promise<ServiceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    await updateReviewStatus(issueNumber, REVIEW_STATUSES.requestChanges, {
        logAction: 'design_changes_requested',
        logDescription: `Changes requested on ${designType} design PR #${prNumber}`,
        logMetadata: { prNumber, designType, reviewStatus: REVIEW_STATUSES.requestChanges },
    });

    void logHistory(issueNumber, 'design_pr_changes_requested', `Changes requested on ${designType} design PR #${prNumber}`, 'admin');

    return { success: true, itemId: item.itemId };
}
