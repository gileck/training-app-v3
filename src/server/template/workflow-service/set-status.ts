/**
 * Workflow Service — Set Status (Direct)
 *
 * Handles status updates for non-routable statuses (PR Review, Done, Final Review, Bug Investigation)
 * that cannot go through routeWorkflowItem. Used by the UI manual status dropdown as a fallback.
 */

import { featureRequests, reports } from '@/server/database';
import {
    findWorkflowItemById,
    updateWorkflowFields,
} from '@/server/database/collections/template/workflow-items';
import { getInitializedAdapter, logHistory } from './utils';
import type { ServiceResult } from './types';

/**
 * Set the status of a workflow item directly (bypassing routing validation).
 *
 * 1. Updates workflow-items DB
 * 2. Looks up source doc → gets githubProjectItemId
 * 3. Updates adapter status
 */
export async function setWorkflowStatus(
    workflowItemId: string,
    status: string
): Promise<ServiceResult> {
    const item = await findWorkflowItemById(workflowItemId);
    if (!item) {
        return { success: false, error: 'Workflow item not found' };
    }

    // Update workflow-items DB
    await updateWorkflowFields(workflowItemId, { workflowStatus: status });

    // Look up source doc to get githubProjectItemId for adapter update
    if (item.sourceRef) {
        const sourceDoc = item.sourceRef.collection === 'feature-requests'
            ? await featureRequests.findFeatureRequestById(item.sourceRef.id.toString())
            : await reports.findReportById(item.sourceRef.id.toString());

        if (sourceDoc?.githubProjectItemId) {
            const adapter = await getInitializedAdapter();
            await adapter.updateItemStatus(sourceDoc.githubProjectItemId, status);
        }
    }

    if (item.githubIssueNumber) {
        void logHistory(item.githubIssueNumber, 'status_changed', `Status changed to ${status}`, 'admin');
    }

    return { success: true, itemId: workflowItemId };
}
