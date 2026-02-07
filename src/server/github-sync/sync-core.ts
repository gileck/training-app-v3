/**
 * GitHub Sync Core
 *
 * Shared sync logic for feature requests and bug reports.
 * Both item types use this core function with type-specific configuration.
 */

import { getProjectManagementAdapter, STATUSES } from '@/server/project-management';
import { ensureArtifactComment } from '@/agents/lib';
import { writeLogHeader } from '@/agents/lib/logging';
import type {
    SyncToGitHubResult,
    SyncOptions,
    SyncItemConfig,
    ApproveItemConfig,
    GitHubSyncedFields,
} from './types';

/**
 * Core sync function - handles the common workflow for syncing any item to GitHub
 *
 * Flow:
 * 1. Get item from database
 * 2. Check if already synced (return existing result)
 * 3. Initialize project management adapter
 * 4. Create GitHub issue with title, body, labels
 * 5. Add issue to project board
 * 6. Set status to Backlog
 * 7. Create empty artifact comment
 * 8. Update MongoDB with GitHub fields
 * 9. Send routing notification (unless skipped)
 */
export async function syncItemToGitHub<T extends GitHubSyncedFields>(
    itemId: string,
    config: SyncItemConfig<T>,
    options?: SyncOptions
): Promise<SyncToGitHubResult> {
    try {
        // 1. Get the item from database
        const item = await config.getFromDB(itemId);
        if (!item) {
            return { success: false, error: 'Item not found' };
        }

        // 2. Check if already synced
        if (config.isAlreadySynced(item)) {
            return config.getExistingSyncResult(item);
        }

        // 3. Initialize project management adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // 4. Create the issue
        const title = config.getTitle(item);
        const body = config.buildBody(item);
        const labels = config.getLabels(item);

        const issueResult = await adapter.createIssue(title, body, labels);
        const { number: issueNumber, url: issueUrl, nodeId: issueNodeId } = issueResult;

        // 4b. Initialize the agent log file
        const issueType = labels[0] || 'unknown'; // 'feature' or 'bug'
        writeLogHeader(issueNumber, title, issueType);

        // 5. Add issue to project (creates workflow-item document)
        const itemType = labels.includes('bug') ? 'bug' : 'feature';
        const projectItemId = await adapter.addIssueToProject(issueNodeId, {
            type: itemType as 'feature' | 'bug',
            mongoId: itemId,
            title,
            labels,
            githubIssueNumber: issueNumber,
            githubIssueUrl: issueUrl,
        });

        // 6. Set initial status (defaults to Backlog)
        const initialStatus = config.initialStatus || STATUSES.backlog;
        await adapter.updateItemStatus(projectItemId, initialStatus);

        // 7. Create empty artifact comment (design docs and implementation PRs will be tracked here)
        await ensureArtifactComment(adapter, issueNumber);

        // 8. Update MongoDB with GitHub fields
        await config.updateDBWithGitHubFields(itemId, {
            githubIssueUrl: issueUrl,
            githubIssueNumber: issueNumber,
            githubProjectItemId: projectItemId,
            githubIssueTitle: title,
        });

        // 9. Send routing notification (unless skipped or auto-routed via initialStatus)
        if (!options?.skipNotification && !config.initialStatus) {
            try {
                await config.sendRoutingNotification(item, { number: issueNumber, url: issueUrl });
            } catch (error) {
                // Don't fail if notification fails
                console.warn('Failed to send routing notification:', error);
            }
        }

        return {
            success: true,
            issueNumber,
            issueUrl,
            projectItemId,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('GitHub sync error:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Core approve function - handles the common workflow for approving any item
 *
 * Flow:
 * 1. Update MongoDB status to "in progress"
 * 2. Sync to GitHub
 * 3. If sync fails, revert status to "new"
 * 4. Return the updated item
 */
export async function approveItem<T extends GitHubSyncedFields>(
    itemId: string,
    config: ApproveItemConfig<T>
): Promise<{
    success: boolean;
    item?: T;
    githubResult?: SyncToGitHubResult;
    error?: string;
}> {
    try {
        // 1. Update status to in progress
        const updated = await config.setInProgressStatus(itemId);
        if (!updated) {
            return { success: false, error: 'Item not found' };
        }

        // 2. Sync to GitHub
        const githubResult = await config.syncToGitHub(itemId);

        if (!githubResult.success) {
            // 3. Revert status if GitHub sync failed
            await config.revertToNewStatus(itemId);
            return {
                success: false,
                error: `GitHub sync failed: ${githubResult.error}`,
            };
        }

        // 4. Fetch and return the updated item
        const finalItem = await config.getFromDB(itemId);

        return {
            success: true,
            item: finalItem || undefined,
            githubResult,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Approve item error:', errorMsg);
        return { success: false, error: errorMsg };
    }
}
