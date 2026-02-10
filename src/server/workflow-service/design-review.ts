/**
 * Workflow Service — Design Review
 *
 * Handles design review actions (approve/changes/reject) for items
 * in design phases. Extracted from Telegram handler so both
 * Telegram and UI share the same code path.
 */

import { REVIEW_STATUSES } from '@/server/project-management/config';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExists,
} from '@/agents/lib/logging';
import { findItemByIssueNumber } from './utils';
import { updateReviewStatus } from './review-status';
import { advanceStatus } from './advance';
import { STATUS_TRANSITIONS } from './constants';
import type { ServiceResult } from './types';

type ReviewAction = 'approve' | 'changes' | 'reject';

const ACTION_TO_REVIEW_STATUS: Record<ReviewAction, string> = {
    approve: REVIEW_STATUSES.approved,
    changes: REVIEW_STATUSES.requestChanges,
    reject: REVIEW_STATUSES.rejected,
};

const ACTION_LABELS: Record<ReviewAction, string> = {
    approve: 'Approved',
    changes: 'Requested Changes',
    reject: 'Rejected',
};

const DESIGN_PHASES = [
    'Product Development',
    'Product Design',
    'Bug Investigation',
    'Technical Design',
];

export interface DesignReviewResult extends ServiceResult {
    advancedTo?: string;
    previousStatus?: string;
    reviewStatus?: string;
}

/**
 * Review a design phase item (approve, request changes, or reject).
 *
 * 1. Validates item exists and is in a reviewable design phase
 * 2. Updates review status
 * 3. If approved, auto-advances to next phase via STATUS_TRANSITIONS
 * 4. Logs all actions
 */
export async function reviewDesign(
    issueNumber: number,
    action: ReviewAction
): Promise<DesignReviewResult> {
    const reviewStatus = ACTION_TO_REVIEW_STATUS[action];

    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    // Validate item is in a design phase
    if (item.status && !DESIGN_PHASES.includes(item.status)) {
        return {
            success: false,
            error: `Item is no longer in a reviewable design phase (current status: ${item.status})`,
        };
    }

    // Update the review status
    await updateReviewStatus(issueNumber, reviewStatus, {
        logAction: `design_${action}`,
        logDescription: `Design ${ACTION_LABELS[action].toLowerCase()}`,
        logMetadata: { reviewStatus, previousStatus: item.status },
    });

    let advancedTo: string | undefined;

    // If approved, auto-advance to next phase
    if (action === 'approve' && item.status) {
        const nextStatus = STATUS_TRANSITIONS[item.status];
        if (nextStatus) {
            await advanceStatus(issueNumber, nextStatus, {
                logAction: 'status_advanced',
                logDescription: `Status advanced to ${nextStatus}`,
                logMetadata: { from: item.status, to: nextStatus },
            });
            advancedTo = nextStatus;
        }
    }

    // Log to agent log file
    if (logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Design Review', 'webhook');
        logWebhookAction(issueNumber, `design_${action}`, `Design ${ACTION_LABELS[action].toLowerCase()}`, {
            issueNumber,
            reviewStatus,
            previousStatus: item.status,
            advancedTo,
        });
        if (advancedTo) {
            logWebhookAction(issueNumber, 'status_advanced', `Status advanced to ${advancedTo}`, {
                from: item.status,
                to: advancedTo,
            });
        }
        logWebhookPhaseEnd(issueNumber, 'Design Review', action === 'reject' ? 'failed' : 'success', 'webhook');
    }

    return {
        success: true,
        itemId: item.itemId,
        advancedTo,
        previousStatus: item.status || undefined,
        reviewStatus,
    };
}
