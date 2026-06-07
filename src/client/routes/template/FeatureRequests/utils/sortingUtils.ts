/**
 * Sorting utilities for Feature Requests list
 *
 * Provides multiple sorting modes including Smart sort that prioritizes
 * items needing attention. Driven entirely by the native `status` and
 * `priority` fields.
 */

import type { FeatureRequestClient, FeatureRequestPriority } from '@/apis/template/feature-requests/types';

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
 * Check if item is in progress (native status)
 */
function isInProgress(request: FeatureRequestClient): boolean {
    return request.status === 'in_progress';
}

/**
 * Check if item is done (native status)
 */
function isDone(request: FeatureRequestClient): boolean {
    return request.status === 'done';
}

/**
 * Smart sort: Prioritize items needing attention
 *
 * Order:
 * 1. In Progress (sorted by updatedAt, least recent first)
 * 2. New (sorted by priority, then creation date)
 * 3. Everything else (e.g. rejected) by priority, then creation date
 *
 * Done items are excluded - they're handled separately via separateDoneItems().
 */
export function smartSort(requests: FeatureRequestClient[]): FeatureRequestClient[] {
    const inProgress: FeatureRequestClient[] = [];
    const newItems: FeatureRequestClient[] = [];
    const other: FeatureRequestClient[] = [];

    requests.forEach((request) => {
        if (isDone(request)) {
            return; // Skip done items - handled separately
        } else if (isInProgress(request)) {
            inProgress.push(request);
        } else if (request.status === 'new') {
            newItems.push(request);
        } else {
            other.push(request);
        }
    });

    // Sort in progress by updatedAt (least recent first = needs attention)
    inProgress.sort((a, b) => {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

    const byPriorityThenAge = (a: FeatureRequestClient, b: FeatureRequestClient) => {
        const priorityA = PRIORITY_ORDER[a.priority || 'medium'];
        const priorityB = PRIORITY_ORDER[b.priority || 'medium'];

        if (priorityA !== priorityB) {
            return priorityB - priorityA; // Higher priority first
        }

        // Same priority: older items first
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    };

    newItems.sort(byPriorityThenAge);
    other.sort(byPriorityThenAge);

    return [...inProgress, ...newItems, ...other];
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
    mode: SortMode
): FeatureRequestClient[] {
    switch (mode) {
        case 'smart':
            return smartSort(requests);
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
    requests: FeatureRequestClient[]
): {
    activeItems: FeatureRequestClient[];
    doneItems: FeatureRequestClient[];
} {
    const activeItems: FeatureRequestClient[] = [];
    const doneItems: FeatureRequestClient[] = [];

    requests.forEach((request) => {
        if (isDone(request)) {
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
