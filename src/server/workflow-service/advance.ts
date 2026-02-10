/**
 * Workflow Service — Status Advancement
 *
 * Handles mid-pipeline status transitions (not routing from entry).
 * Includes markDone which has additional side effects.
 */

import { featureRequests, reports } from '@/server/database';
import {
    logWebhookAction,
    logExists,
    syncLogToRepoAndCleanup,
} from '@/agents/lib/logging';
import {
    getInitializedAdapter,
    findItemByIssueNumber,
    syncWorkflowStatus,
} from './utils';
import type { AdvanceResult, MarkDoneResult, ServiceOptions } from './types';
import { STATUSES } from '@/server/project-management/config';

/**
 * Advance a workflow item to a new status.
 *
 * 1. Finds the item by issue number
 * 2. Updates the status via adapter
 * 3. Optionally clears review status (default: true)
 * 4. Syncs to workflow-items DB
 * 5. Logs the action
 */
export async function advanceStatus(
    issueNumber: number,
    toStatus: string,
    options?: ServiceOptions & { clearReview?: boolean }
): Promise<AdvanceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    const adapter = await getInitializedAdapter();
    const previousStatus = item.status || undefined;

    await adapter.updateItemStatus(item.itemId, toStatus);

    // Clear review status by default (most transitions need this)
    const shouldClearReview = options?.clearReview !== false;
    if (shouldClearReview && adapter.hasReviewStatusField() && item.reviewStatus) {
        await adapter.clearItemReviewStatus(item.itemId);
    }

    // Sync to workflow-items DB
    await syncWorkflowStatus(issueNumber, toStatus);

    // Log
    if (options?.logAction && logExists(issueNumber)) {
        logWebhookAction(
            issueNumber,
            options.logAction,
            options.logDescription || `Status advanced to ${toStatus}`,
            { issueNumber, from: previousStatus, to: toStatus, ...options.logMetadata }
        );
    }

    return { success: true, itemId: item.itemId, previousStatus };
}

/**
 * Mark a workflow item as Done.
 *
 * In addition to advanceStatus, markDone:
 * 1. Clears the implementation phase field
 * 2. Updates the source document status (feature→done, bug→resolved)
 * 3. Syncs log to repo (non-blocking)
 */
export async function markDone(
    issueNumber: number,
    options?: ServiceOptions
): Promise<MarkDoneResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    const adapter = await getInitializedAdapter();

    // Update status to Done
    await adapter.updateItemStatus(item.itemId, STATUSES.done);

    // Clear review status
    if (adapter.hasReviewStatusField() && item.reviewStatus) {
        await adapter.clearItemReviewStatus(item.itemId);
    }

    // Clear implementation phase
    await adapter.clearImplementationPhase(item.itemId);

    // Sync to workflow-items DB
    await syncWorkflowStatus(issueNumber, STATUSES.done);

    // Log
    if (logExists(issueNumber)) {
        logWebhookAction(
            issueNumber,
            options?.logAction || 'status_done',
            options?.logDescription || 'Issue marked as Done',
            { status: STATUSES.done, ...options?.logMetadata }
        );
    }

    // Sync log to repo (non-blocking)
    syncLogToRepoAndCleanup(issueNumber).catch((err) => {
        console.error(`  [LOG:S3_SYNC] Failed to sync log for issue #${issueNumber}:`, err);
    });

    // Update source document status
    let sourceDocUpdated = false;
    try {
        const featureRequest = await featureRequests.findByGitHubIssueNumber(issueNumber);
        if (featureRequest) {
            await featureRequests.updateFeatureRequestStatus(featureRequest._id, 'done');
            sourceDocUpdated = true;
            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'mongodb_updated', 'Feature request marked as done in database', {
                    featureRequestId: featureRequest._id.toString(),
                });
            }
        } else {
            const bugReport = await reports.findByGitHubIssueNumber(issueNumber);
            if (bugReport) {
                await reports.updateReport(bugReport._id.toString(), { status: 'resolved' });
                sourceDocUpdated = true;
                if (logExists(issueNumber)) {
                    logWebhookAction(issueNumber, 'mongodb_updated', 'Bug report marked as resolved in database', {
                        bugReportId: bugReport._id.toString(),
                    });
                }
            }
        }
    } catch (error) {
        console.error(`[workflow-service] Failed to update source document status for issue #${issueNumber}:`, error);
    }

    return { success: true, itemId: item.itemId, sourceDocUpdated };
}
