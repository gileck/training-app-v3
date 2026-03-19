/**
 * Workflow Service — Phase Management
 *
 * Manages implementation phase transitions for multi-phase workflows.
 */

import {
    logWebhookAction,
    logExists,
} from '@/agents/lib/logging';
import { getInitializedAdapter, findItemByIssueNumber, syncWorkflowStatus } from './utils';
import type { ServiceResult, ServiceOptions } from './types';

/**
 * Advance to the next implementation phase.
 *
 * 1. Sets the phase field (e.g., "2/3")
 * 2. Updates the status
 * 3. Clears review status
 * 4. Syncs DB
 * 5. Logs
 */
export async function advanceImplementationPhase(
    issueNumber: number,
    nextPhase: string,
    toStatus: string,
    options?: ServiceOptions
): Promise<ServiceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    const adapter = await getInitializedAdapter();

    await adapter.setImplementationPhase(item.itemId, nextPhase);
    await adapter.updateItemStatus(item.itemId, toStatus);

    if (adapter.hasReviewStatusField() && item.reviewStatus) {
        await adapter.clearItemReviewStatus(item.itemId);
    }

    await syncWorkflowStatus(issueNumber, toStatus);

    if (options?.logAction && logExists(issueNumber)) {
        logWebhookAction(
            issueNumber,
            options.logAction,
            options.logDescription || `Phase advanced to ${nextPhase}`,
            { issueNumber, phase: nextPhase, status: toStatus, ...options.logMetadata }
        );
    }

    return { success: true, itemId: item.itemId };
}

/**
 * Clear the implementation phase field.
 */
export async function clearImplementationPhase(
    issueNumber: number,
    options?: ServiceOptions
): Promise<ServiceResult> {
    const item = await findItemByIssueNumber(issueNumber);
    if (!item) {
        return { success: false, error: `Issue #${issueNumber} not found in project` };
    }

    const adapter = await getInitializedAdapter();
    await adapter.clearImplementationPhase(item.itemId);

    if (options?.logAction && logExists(issueNumber)) {
        logWebhookAction(
            issueNumber,
            options.logAction,
            options.logDescription || 'Implementation phase cleared',
            { issueNumber, ...options.logMetadata }
        );
    }

    return { success: true, itemId: item.itemId };
}
