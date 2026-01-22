/**
 * GitHub Project Status Service
 *
 * Fetches and updates GitHub Project status for feature requests.
 * Uses the project management adapter.
 */

import { getProjectManagementAdapter } from '@/server/project-management';

/**
 * GitHub Project status for a project item
 */
export interface GitHubProjectStatus {
    status: string | null;
    reviewStatus: string | null;
    issueState: 'OPEN' | 'CLOSED' | null;
}

/**
 * Get the GitHub Project status for a project item
 */
export async function getGitHubProjectStatus(
    projectItemId: string
): Promise<GitHubProjectStatus | null> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        const item = await adapter.getItem(projectItemId);
        if (!item) return null;

        return {
            status: item.status,
            reviewStatus: item.reviewStatus,
            issueState: item.content?.state || null,
        };
    } catch (error) {
        console.error('Failed to fetch GitHub project status:', error);
        return null;
    }
}

/**
 * Get available GitHub Project status options
 */
export async function getAvailableStatuses(): Promise<string[]> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();
        return await adapter.getAvailableStatuses();
    } catch (error) {
        console.error('Failed to fetch available statuses:', error);
        return [];
    }
}

/**
 * Get available GitHub Project review status options
 */
export async function getAvailableReviewStatuses(): Promise<string[]> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();
        return await adapter.getAvailableReviewStatuses();
    } catch (error) {
        console.error('Failed to fetch available review statuses:', error);
        return [];
    }
}

/**
 * Update the GitHub Project status for a project item
 */
export async function updateGitHubProjectStatus(
    projectItemId: string,
    status: string
): Promise<boolean> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();
        await adapter.updateItemStatus(projectItemId, status);
        return true;
    } catch (error) {
        console.error('Failed to update GitHub project status:', error);
        return false;
    }
}

/**
 * Update the GitHub Project review status for a project item
 */
export async function updateGitHubReviewStatus(
    projectItemId: string,
    reviewStatus: string
): Promise<boolean> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();
        await adapter.updateItemReviewStatus(projectItemId, reviewStatus);
        return true;
    } catch (error) {
        console.error('Failed to update GitHub review status:', error);
        return false;
    }
}

/**
 * Clear the GitHub Project review status for a project item
 * This sets the field to empty/null, making it ready for agent processing
 */
export async function clearGitHubReviewStatus(
    projectItemId: string
): Promise<boolean> {
    try {
        const adapter = getProjectManagementAdapter();
        await adapter.init();
        await adapter.clearItemReviewStatus(projectItemId);
        return true;
    } catch (error) {
        console.error('Failed to clear GitHub review status:', error);
        return false;
    }
}
