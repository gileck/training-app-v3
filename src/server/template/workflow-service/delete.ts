/**
 * Workflow Service — Delete
 *
 * Unified deletion that fixes all gaps across transports.
 */

import { featureRequests, reports } from '@/server/database';
import { deleteWorkflowItemBySourceRef } from '@/server/database/collections/template/workflow-items';
import { GitHubClient } from '@/server/template/project-management/github-client';
import { notifyDeleted } from './notify';
import type { WorkflowItemRef, DeleteOptions, DeleteResult } from './types';

/**
 * Delete a workflow item — validates state, cleans up all references.
 *
 * 1. Fetches source document
 * 2. Checks GitHub sync status (blocks unless force)
 * 3. Deletes from source collection
 * 4. Always cleans up workflow-items
 * 5. Sends Telegram notification
 */
export async function deleteWorkflowItem(
    ref: WorkflowItemRef,
    options?: DeleteOptions
): Promise<DeleteResult> {
    // 1. Fetch source document
    const sourceCollection = ref.type === 'feature' ? 'feature-requests' as const : 'reports' as const;

    const doc = ref.type === 'feature'
        ? await featureRequests.findFeatureRequestById(ref.id)
        : await reports.findReportById(ref.id);

    if (!doc) {
        // Source doc already gone — still try to clean up orphaned workflow-items
        await deleteWorkflowItemBySourceRef(sourceCollection, ref.id);
        return { success: true, title: 'Already deleted' };
    }

    // 2. Check GitHub sync status
    if (doc.githubIssueUrl && !options?.force) {
        return { success: false, error: 'Cannot delete: already synced to GitHub' };
    }

    // Get title for notification before deleting
    const title = ref.type === 'feature'
        ? (doc as { title?: string }).title || 'Feature Request'
        : (doc as { description?: string }).description?.slice(0, 100) || 'Bug Report';

    // 3. Delete from source collection
    let deleted: boolean;
    if (ref.type === 'feature') {
        deleted = await featureRequests.deleteFeatureRequest(ref.id);
    } else {
        deleted = await reports.deleteReport(ref.id);
    }

    if (!deleted) {
        return { success: false, error: `Failed to delete ${ref.type}` };
    }

    // 4. Always clean up workflow-items
    await deleteWorkflowItemBySourceRef(sourceCollection, ref.id);

    // 5. Close GitHub issue and add comment (fire-and-forget)
    const githubIssueNumber = (doc as { githubIssueNumber?: number }).githubIssueNumber;
    if (githubIssueNumber) {
        (async () => {
            try {
                const gh = new GitHubClient();
                await gh.init();
                await gh.addIssueComment(githubIssueNumber, 'This item was deleted from the workflow.');
                await gh.closeIssue(githubIssueNumber);
            } catch (error) {
                console.error('Failed to close GitHub issue:', error);
            }
        })();
    }

    // 6. Send Telegram notification (fire-and-forget)
    notifyDeleted(ref, title).catch(() => {});

    return { success: true, title };
}
