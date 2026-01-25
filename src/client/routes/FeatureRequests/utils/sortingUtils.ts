/**
 * Sorting utilities for Feature Requests list
 *
 * Provides multiple sorting modes including Smart sort that prioritizes
 * items needing attention.
 */

import type { FeatureRequestClient, FeatureRequestPriority } from '@/apis/feature-requests/types';
import type { GetGitHubStatusResponse } from '@/apis/feature-requests/types';

/**
 * Sort mode options
 */
export type SortMode = 'smart' | 'newest' | 'oldest' | 'priority' | 'updated';

/**
 * Priority order for sorting (higher number = higher priority)
 */
const PRIORITY_ORDER: Record<FeatureRequestPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};


/**
 * Get effective status for sorting purposes
 * Prioritizes GitHub status when available, falls back to DB status
 */
function getEffectiveStatus(
    request: FeatureRequestClient,
    githubStatusMap?: Record<string, GetGitHubStatusResponse | undefined>
): string {
    if (request.githubProjectItemId && githubStatusMap?.[request._id]?.status) {
        return githubStatusMap[request._id]?.status?.toLowerCase() || '';
    }
    return request.status.toLowerCase();
}

/**
 * Check if item is "Waiting for Review"
 * Can be indicated by GitHub status or review status
 */
function isWaitingForReview(
    request: FeatureRequestClient,
    githubStatusMap?: Record<string, GetGitHubStatusResponse | undefined>
): boolean {
    // Check GitHub review status
    if (request.githubProjectItemId && githubStatusMap?.[request._id]?.reviewStatus) {
        return true;
    }

    // Check GitHub status
    const status = getEffectiveStatus(request, githubStatusMap);
    return status.toLowerCase().includes('waiting') || status.toLowerCase().includes('review');
}

/**
 * Check if item is blocked
 */
function isBlocked(
    request: FeatureRequestClient,
    githubStatusMap?: Record<string, GetGitHubStatusResponse | undefined>
): boolean {
    const status = getEffectiveStatus(request, githubStatusMap);
    return status.toLowerCase().includes('blocked');
}

/**
 * Check if item is in progress
 */
function isInProgress(
    request: FeatureRequestClient,
    githubStatusMap?: Record<string, GetGitHubStatusResponse | undefined>
): boolean {
    const status = getEffectiveStatus(request, githubStatusMap);
    return status === 'in_progress' || status.toLowerCase().includes('in progress');
}

/**
 * Check if item is done
 */
function isDone(
    request: FeatureRequestClient,
    githubStatusMap?: Record<string, GetGitHubStatusResponse | undefined>
): boolean {
    const status = getEffectiveStatus(request, githubStatusMap);
    return status === 'done' || status.toLowerCase() === 'done';
}

/**
 * Smart sort: Prioritize items needing attention
 *
 * Order:
 * 1. Blocked (sorted by time in status, longest first)
 * 2. Waiting for Review (sorted by time in status, longest first)
 * 3. In Progress (sorted by updatedAt, least recent first)
 * 4. New/Backlog (sorted by priority, then creation date)
 * 5. Done items are excluded (handled separately)
 */
export function smartSort(
    requests: FeatureRequestClient[],
    githubStatusMap?: Record<string, GetGitHubStatusResponse | undefined>
): FeatureRequestClient[] {
    // Separate into categories
    // Note: Done items are excluded - they're handled separately via separateDoneItems()
    const blocked: FeatureRequestClient[] = [];
    const waitingForReview: FeatureRequestClient[] = [];
    const inProgress: FeatureRequestClient[] = [];
    const newOrBacklog: FeatureRequestClient[] = [];

    requests.forEach((request) => {
        if (isDone(request, githubStatusMap)) {
            return; // Skip done items - handled separately
        } else if (isBlocked(request, githubStatusMap)) {
            blocked.push(request);
        } else if (isWaitingForReview(request, githubStatusMap)) {
            waitingForReview.push(request);
        } else if (isInProgress(request, githubStatusMap)) {
            inProgress.push(request);
        } else {
            newOrBacklog.push(request);
        }
    });

    // Sort blocked items by time in status (longest first = oldest updatedAt)
    blocked.sort((a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

    // Sort waiting for review items by time in status (longest first)
    waitingForReview.sort((a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

    // Sort in progress by updatedAt (least recent first = needs attention)
    inProgress.sort((a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

    // Sort new/backlog by priority, then creation date (older first)
    newOrBacklog.sort((a, b) => {
        const priorityA = PRIORITY_ORDER[a.priority || 'medium'];
        const priorityB = PRIORITY_ORDER[b.priority || 'medium'];

        if (priorityA !== priorityB) {
            return priorityB - priorityA; // Higher priority first
        }

        // Same priority: older items first
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Concatenate in priority order (excluding done)
    return [...blocked, ...waitingForReview, ...inProgress, ...newOrBacklog];
}

/**
 * Sort by creation date (newest first)
 */
export function sortByNewest(requests: FeatureRequestClient[]): FeatureRequestClient[] {
    return [...requests].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

/**
 * Sort by creation date (oldest first)
 */
export function sortByOldest(requests: FeatureRequestClient[]): FeatureRequestClient[] {
    return [...requests].sort((a, b) => {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

/**
 * Sort by priority (Critical → High → Medium → Low)
 * Within same priority, sort by creation date (oldest first)
 */
export function sortByPriority(requests: FeatureRequestClient[]): FeatureRequestClient[] {
    return [...requests].sort((a, b) => {
        const priorityA = PRIORITY_ORDER[a.priority || 'medium'];
        const priorityB = PRIORITY_ORDER[b.priority || 'medium'];

        if (priorityA !== priorityB) {
            return priorityB - priorityA; // Higher priority first
        }

        // Same priority: older items first
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

/**
 * Sort by last update (most recent activity first)
 */
export function sortByUpdated(requests: FeatureRequestClient[]): FeatureRequestClient[] {
    return [...requests].sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

/**
 * Apply sorting based on mode
 */
export function applySorting(
    requests: FeatureRequestClient[],
    mode: SortMode,
    githubStatusMap?: Record<string, GetGitHubStatusResponse | undefined>
): FeatureRequestClient[] {
    switch (mode) {
        case 'smart':
            return smartSort(requests, githubStatusMap);
        case 'newest':
            return sortByNewest(requests);
        case 'oldest':
            return sortByOldest(requests);
        case 'priority':
            return sortByPriority(requests);
        case 'updated':
            return sortByUpdated(requests);
        default:
            return requests;
    }
}

/**
 * Separate done items from active items
 */
export function separateDoneItems(
    requests: FeatureRequestClient[],
    githubStatusMap?: Record<string, GetGitHubStatusResponse | undefined>
): {
    activeItems: FeatureRequestClient[];
    doneItems: FeatureRequestClient[];
} {
    const activeItems: FeatureRequestClient[] = [];
    const doneItems: FeatureRequestClient[] = [];

    requests.forEach((request) => {
        if (isDone(request, githubStatusMap)) {
            doneItems.push(request);
        } else {
            activeItems.push(request);
        }
    });

    // Sort done items by completion date (most recent first = newest updatedAt)
    doneItems.sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return { activeItems, doneItems };
}
