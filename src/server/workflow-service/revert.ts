/**
 * Workflow Service — Revert Operations
 *
 * Creates revert PRs and merges them.
 * Extracted from Telegram handler so both Telegram and UI
 * share the same code path.
 */

import { STATUSES, REVIEW_STATUSES } from '@/server/project-management/config';
import {
    logWebhookAction,
    logExists,
} from '@/agents/lib/logging';
import { featureRequests, reports } from '@/server/database';
import { setRevertPrNumber, clearRevertPrNumber } from '@/server/database/collections/template/workflow-items';
import { getInitializedAdapter, findItemByIssueNumber } from './utils';
import { advanceStatus } from './advance';
import { updateReviewStatus } from './review-status';
import type { ServiceResult } from './types';

export interface RevertResult extends ServiceResult {
    revertPrNumber?: number;
    revertPrUrl?: string;
}

/**
 * Create a revert PR for a merged implementation PR.
 *
 * 1. Validates merge commit SHA
 * 2. Creates revert PR via adapter
 * 3. Restores status to Implementation + Request Changes
 * 4. Restores implementation phase if applicable
 * 5. Reverts source doc status
 */
export async function revertMerge(
    issueNumber: number,
    prNumber: number,
    shortSha?: string,
    phase?: string
): Promise<RevertResult> {
    const adapter = await getInitializedAdapter();

    const fullSha = await adapter.getMergeCommitSha(prNumber);
    if (!fullSha) {
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'revert_failed', `Could not find merge commit SHA for PR #${prNumber}`, {
                prNumber,
                shortSha,
            });
        }
        return { success: false, error: 'Could not find merge commit SHA' };
    }

    // Only validate SHA prefix when provided (Telegram path)
    if (shortSha && !fullSha.startsWith(shortSha)) {
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'revert_failed', `Merge commit SHA mismatch for PR #${prNumber}`, {
                prNumber,
                expectedPrefix: shortSha,
                actualSha: fullSha,
            });
        }
        return { success: false, error: 'Merge commit SHA mismatch' };
    }

    const revertResult = await adapter.createRevertPR(fullSha, prNumber, issueNumber);
    if (!revertResult) {
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'revert_failed', `Failed to create revert PR for PR #${prNumber} - may have conflicts`, {
                prNumber,
                mergeCommitSha: fullSha,
            });
        }
        return { success: false, error: 'Failed to create revert PR. There may be conflicts - please revert manually.' };
    }

    // Persist revert PR number for UI merge-revert capability
    await setRevertPrNumber(issueNumber, revertResult.prNumber);

    // Restore status to Implementation with Request Changes
    await advanceStatus(issueNumber, STATUSES.implementation, {
        clearReview: false,
        logAction: 'revert_status_restored',
        logDescription: `Status restored to ${STATUSES.implementation}`,
    });

    await updateReviewStatus(issueNumber, REVIEW_STATUSES.requestChanges);

    // Restore phase if applicable
    if (phase) {
        const item = await findItemByIssueNumber(issueNumber);
        if (item && adapter.hasImplementationPhaseField()) {
            await adapter.setImplementationPhase(item.itemId, phase);
        }
    }

    // Revert source document status
    const featureRequest = await featureRequests.findByGitHubIssueNumber(issueNumber);
    if (featureRequest) {
        await featureRequests.updateFeatureRequestStatus(featureRequest._id, 'in_progress');
    } else {
        const bugReport = await reports.findByGitHubIssueNumber(issueNumber);
        if (bugReport) {
            await reports.updateReport(bugReport._id.toString(), { status: 'investigating' });
        }
    }

    if (logExists(issueNumber)) {
        logWebhookAction(issueNumber, 'revert_initiated', `Revert initiated for PR #${prNumber}`, {
            prNumber,
            shortSha,
            revertPrNumber: revertResult.prNumber,
        });
    }

    return {
        success: true,
        revertPrNumber: revertResult.prNumber,
        revertPrUrl: revertResult.url,
    };
}

/**
 * Merge a revert PR.
 *
 * 1. Validates revert PR exists and is open
 * 2. Merges revert PR
 * 3. Deletes revert branch
 */
export async function mergeRevertPR(
    issueNumber: number,
    revertPrNumber: number
): Promise<ServiceResult> {
    const adapter = await getInitializedAdapter();

    const prInfo = await adapter.getPRInfo(revertPrNumber);
    if (!prInfo) {
        return { success: false, error: 'Revert PR not found' };
    }

    const prDetails = await adapter.getPRDetails(revertPrNumber);
    if (!prDetails) {
        return { success: false, error: 'Could not get revert PR details' };
    }
    if (prDetails.merged) {
        return { success: false, error: 'Revert PR already merged' };
    }
    if (prDetails.state === 'closed') {
        return { success: false, error: 'Revert PR is closed' };
    }

    const commitTitle = prInfo.title;
    const commitBody = `Part of #${issueNumber}`;

    await adapter.mergePullRequest(revertPrNumber, commitTitle, commitBody);

    // Clear the revert PR number now that it's merged
    await clearRevertPrNumber(issueNumber);

    try {
        await adapter.deleteBranch(prDetails.headBranch);
    } catch {
        // Branch already deleted
    }

    if (logExists(issueNumber)) {
        logWebhookAction(issueNumber, 'revert_merged', `Revert PR #${revertPrNumber} merged`, {
            revertPrNumber,
        });
    }

    return { success: true };
}
