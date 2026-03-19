/**
 * Workflow Service — Route
 *
 * Unified routing that always goes through the adapter and clears review status.
 */

import { featureRequests, reports } from '@/server/database';
import { getProjectManagementAdapter } from '@/server/template/project-management';
import {
    findWorkflowItemById,
    findWorkflowItemBySourceRef,
    updateWorkflowFields,
} from '@/server/database/collections/template/workflow-items';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExists,
} from '@/agents/lib/logging';
import { getRoutingStatusMap, statusToDestination, ROUTING_DESTINATION_LABELS } from './constants';
import { notifyRouted } from './notify';
import { logHistory } from './utils';
import type { WorkflowItemRef, RoutingDestination, RouteResult } from './types';

/**
 * Route a workflow item to a destination phase.
 *
 * 1. Looks up source document to get githubProjectItemId
 * 2. Validates state and destination
 * 3. Updates adapter status
 * 4. Clears review status (unless backlog)
 * 5. Agent logging
 * 6. Sends Telegram notification
 */
export async function routeWorkflowItem(
    ref: WorkflowItemRef,
    destination: RoutingDestination
): Promise<RouteResult> {
    // 1. Look up source document
    const doc = ref.type === 'feature'
        ? await featureRequests.findFeatureRequestById(ref.id)
        : await reports.findReportById(ref.id);

    if (!doc || !doc.githubProjectItemId) {
        return { success: false, error: 'Item not found or not yet synced to GitHub' };
    }

    // 2. Validate destination
    const statusMap = getRoutingStatusMap(ref.type);
    const targetStatus = statusMap[destination];
    if (!targetStatus) {
        return { success: false, error: `Invalid routing destination: ${destination}` };
    }

    const targetLabel = ROUTING_DESTINATION_LABELS[destination] || destination;

    // 3. Update adapter status
    const adapter = getProjectManagementAdapter();
    await adapter.init();
    await adapter.updateItemStatus(doc.githubProjectItemId, targetStatus);

    // 4. Clear review status if moving to a phase that agents process
    if (destination !== 'backlog' && adapter.hasReviewStatusField()) {
        await adapter.clearItemReviewStatus(doc.githubProjectItemId);
    }

    // 4b. Update local workflow-items DB to keep in sync
    const sourceCollection = ref.type === 'feature' ? 'feature-requests' as const : 'reports' as const;
    const workflowItem = await findWorkflowItemBySourceRef(sourceCollection, ref.id);
    if (workflowItem) {
        await updateWorkflowFields(workflowItem._id, { workflowStatus: targetStatus });
    }

    // 5. Agent logging
    const issueNumber = doc.githubIssueNumber;
    if (issueNumber && logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Admin Routing', 'webhook');
        logWebhookAction(issueNumber, 'routed', `Routed to ${targetLabel}`, {
            itemId: ref.id,
            itemType: ref.type,
            destination,
            targetStatus,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Routing', 'success', 'webhook');
    }

    // 5b. History log
    if (issueNumber) {
        void logHistory(issueNumber, 'routed', `Routed to ${targetLabel}`, 'admin');
    }

    // 6. Send Telegram notification (fire-and-forget)
    notifyRouted(ref, destination, doc.githubIssueUrl, issueNumber).catch(() => {});

    return { success: true, targetStatus, targetLabel };
}

/**
 * Route a workflow item by its workflow-item ID (used by UI which works with workflow item IDs).
 *
 * Looks up the workflow item, extracts the source ref, and delegates to routeWorkflowItem().
 * The `status` parameter here is a raw status string (e.g., "Product Design"), which is
 * converted to a routing destination.
 */
export async function routeWorkflowItemByWorkflowId(
    workflowItemId: string,
    status: string
): Promise<RouteResult> {
    // Look up the workflow item
    const workflowItem = await findWorkflowItemById(workflowItemId);
    if (!workflowItem) {
        return { success: false, error: 'Workflow item not found' };
    }

    // Convert raw status to destination
    const destination = statusToDestination(status);
    if (!destination) {
        // If no routing destination found, fall back to direct status update
        // This handles statuses like "PR Review", "Done", etc. that aren't routing destinations
        return { success: false, error: `Status "${status}" is not a valid routing destination` };
    }

    // Extract source ref from workflow item
    const sourceRef = workflowItem.sourceRef;

    // Items without sourceRef (CLI-created) — route directly via workflow-items DB
    if (!sourceRef) {
        const statusMap = getRoutingStatusMap(workflowItem.type === 'task' ? 'feature' : workflowItem.type as 'feature' | 'bug');
        const targetStatus = statusMap[destination];
        if (!targetStatus) {
            return { success: false, error: `Invalid routing destination: ${destination}` };
        }
        const targetLabel = ROUTING_DESTINATION_LABELS[destination] || destination;

        // Update workflow-items DB directly (single atomic update)
        const updates: Parameters<typeof updateWorkflowFields>[1] = { workflowStatus: targetStatus };
        if (destination !== 'backlog') {
            updates.workflowReviewStatus = null;
        }
        await updateWorkflowFields(workflowItemId, updates);

        // Agent logging
        const issueNumber = workflowItem.githubIssueNumber;
        if (issueNumber && logExists(issueNumber)) {
            logWebhookPhaseStart(issueNumber, 'Admin Routing', 'webhook');
            logWebhookAction(issueNumber, 'routed', `Routed to ${targetLabel}`, {
                itemId: workflowItemId,
                destination,
                targetStatus,
            });
            logWebhookPhaseEnd(issueNumber, 'Admin Routing', 'success', 'webhook');
        }

        // History log
        if (issueNumber) {
            void logHistory(issueNumber, 'routed', `Routed to ${targetLabel}`, 'admin');
        }

        // Telegram notification
        const ref: WorkflowItemRef = { id: workflowItemId, type: workflowItem.type === 'task' ? 'feature' : workflowItem.type as 'feature' | 'bug' };
        notifyRouted(ref, destination, workflowItem.githubIssueUrl, issueNumber).catch(() => {});

        return { success: true, targetStatus, targetLabel };
    }

    const itemType = sourceRef.collection === 'feature-requests' ? 'feature' : 'bug';

    return routeWorkflowItem(
        { id: sourceRef.id.toString(), type: itemType },
        destination
    );
}
