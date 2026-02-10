/**
 * Workflow Service — Shared Utilities
 *
 * Common helpers used across all workflow service functions.
 */

import { getProjectManagementAdapter } from '@/server/project-management';
import { featureRequests, reports } from '@/server/database';
import {
    findWorkflowItemBySourceRef,
    updateWorkflowFields,
} from '@/server/database/collections/template/workflow-items';

/**
 * Initialize and return the project management adapter.
 * Adapter init is internally cached, so this is safe to call repeatedly.
 */
export async function getInitializedAdapter() {
    const adapter = getProjectManagementAdapter();
    await adapter.init();
    return adapter;
}

/**
 * Project item as returned by findItemByIssueNumber.
 */
export interface ServiceProjectItem {
    itemId: string;
    title: string;
    status: string | null;
    reviewStatus: string | null;
}

/**
 * Find a GitHub Projects item by issue number.
 * Lists all items and matches by content.number.
 */
export async function findItemByIssueNumber(
    issueNumber: number
): Promise<ServiceProjectItem | null> {
    const adapter = await getInitializedAdapter();
    const items = await adapter.listItems({});

    for (const item of items) {
        if (item.content?.number === issueNumber) {
            return {
                itemId: item.id,
                title: item.content.title,
                status: item.status,
                reviewStatus: item.reviewStatus || null,
            };
        }
    }

    return null;
}

/**
 * Source document info resolved from an issue number.
 */
export interface SourceDocInfo {
    id: string;
    type: 'feature' | 'bug';
    githubProjectItemId?: string;
    githubIssueNumber?: number;
    sourceCollection: 'feature-requests' | 'reports';
}

/**
 * Find the source document (feature request or bug report) by GitHub issue number.
 */
export async function findSourceDocByIssueNumber(
    issueNumber: number
): Promise<SourceDocInfo | null> {
    const featureRequest = await featureRequests.findByGitHubIssueNumber(issueNumber);
    if (featureRequest) {
        return {
            id: featureRequest._id.toString(),
            type: 'feature',
            githubProjectItemId: featureRequest.githubProjectItemId,
            githubIssueNumber: featureRequest.githubIssueNumber,
            sourceCollection: 'feature-requests',
        };
    }

    const bugReport = await reports.findByGitHubIssueNumber(issueNumber);
    if (bugReport) {
        return {
            id: bugReport._id.toString(),
            type: 'bug',
            githubProjectItemId: bugReport.githubProjectItemId,
            githubIssueNumber: bugReport.githubIssueNumber,
            sourceCollection: 'reports',
        };
    }

    return null;
}

/**
 * Sync workflow status to the workflow-items DB collection.
 * Looks up the workflow item by source ref and updates the workflowStatus field.
 */
export async function syncWorkflowStatus(
    issueNumber: number,
    status: string
): Promise<void> {
    const sourceDoc = await findSourceDocByIssueNumber(issueNumber);
    if (!sourceDoc) return;

    const workflowItem = await findWorkflowItemBySourceRef(
        sourceDoc.sourceCollection,
        sourceDoc.id
    );
    if (workflowItem) {
        await updateWorkflowFields(workflowItem._id, { workflowStatus: status });
    }
}
