/**
 * Workflow Service — Auto-Advance
 *
 * Batch operation: find all approved items and advance them to the next phase.
 */

import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management/config';
import { notifyAutoAdvance } from '@/agents/shared/notifications';
import { agentConfig } from '@/agents/shared/config';
import { getInitializedAdapter, syncWorkflowStatus } from './utils';
import { STATUS_TRANSITIONS } from './constants';
import type { AutoAdvanceResult } from './types';

/**
 * Find all approved items and advance each to the next workflow phase.
 *
 * Transitions:
 *   - Product Development (Approved) → Product Design
 *   - Product Design (Approved) → Technical Design
 *   - Technical Design (Approved) → Implementation
 *   - Implementation (Approved) → Done
 */
export async function autoAdvanceApproved(options?: {
    dryRun?: boolean;
}): Promise<AutoAdvanceResult> {
    const dryRun = options?.dryRun ?? false;
    const adapter = await getInitializedAdapter();

    // Find all items with Review Status = Approved (excluding Done items)
    const allItems = await adapter.listItems({});
    const approvedItems = allItems.filter(
        (item) =>
            item.reviewStatus === REVIEW_STATUSES.approved &&
            item.status !== STATUSES.done
    );

    const details: AutoAdvanceResult['details'] = [];
    let advanced = 0;
    let failed = 0;

    for (const item of approvedItems) {
        const fromStatus = item.status;
        const title = item.content?.title || `Item ${item.id}`;
        const issueNumber = item.content?.number;

        if (!fromStatus) {
            details.push({ issueNumber, title, fromStatus: 'Unknown', toStatus: 'N/A', success: false, error: 'Item has no status' });
            failed++;
            continue;
        }

        // PR Review items are handled by merge handlers, not auto-advance
        if (fromStatus === STATUSES.prReview) {
            details.push({ issueNumber, title, fromStatus, toStatus: 'N/A', success: false, error: 'PR Review handled by merge' });
            failed++;
            continue;
        }

        const toStatus = STATUS_TRANSITIONS[fromStatus];
        if (!toStatus) {
            details.push({ issueNumber, title, fromStatus, toStatus: 'N/A', success: false, error: `No transition defined for ${fromStatus}` });
            failed++;
            continue;
        }

        if (dryRun) {
            details.push({ issueNumber, title, fromStatus, toStatus, success: true });
            advanced++;
            continue;
        }

        try {
            await adapter.updateItemStatus(item.id, toStatus);
            await adapter.updateItemReviewStatus(item.id, '');

            // Sync to workflow-items DB
            if (issueNumber) {
                await syncWorkflowStatus(issueNumber, toStatus);
            }

            // Send Telegram notification
            if (issueNumber && agentConfig.telegram.enabled) {
                await notifyAutoAdvance(title, issueNumber, fromStatus, toStatus);
            }

            details.push({ issueNumber, title, fromStatus, toStatus, success: true });
            advanced++;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            details.push({ issueNumber, title, fromStatus, toStatus, success: false, error: errorMessage });
            failed++;
        }
    }

    return {
        total: approvedItems.length,
        advanced,
        failed,
        details,
    };
}
