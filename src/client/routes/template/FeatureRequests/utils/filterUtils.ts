/**
 * Filter Utility Functions
 *
 * Client-side filtering logic for feature requests list.
 * Supports multi-select filters across status, priority, and activity.
 */

import type {
    FeatureRequestClient,
    FeatureRequestPriority,
} from '@/apis/template/feature-requests/types';

/**
 * Filter by native status
 *
 * Status filter values map to the feature request's `status` field, plus a
 * synthetic 'active' filter (anything not done or rejected).
 */
export function filterByStatus(
    requests: FeatureRequestClient[],
    statusFilters: string[]
): FeatureRequestClient[] {
    // If no status filters active, show all
    if (statusFilters.length === 0) {
        return requests;
    }

    return requests.filter((request) => {
        return statusFilters.some((filter) => {
            switch (filter) {
                case 'active':
                    // Active = not Done or Rejected
                    return request.status !== 'done' && request.status !== 'rejected';
                case 'new':
                    return request.status === 'new';
                case 'in_progress':
                    return request.status === 'in_progress';
                case 'done':
                    return request.status === 'done';
                case 'rejected':
                    return request.status === 'rejected';
                default:
                    return false;
            }
        });
    });
}

/**
 * Filter by priority
 *
 * Multi-select: show requests that match ANY of the selected priorities.
 */
export function filterByPriority(
    requests: FeatureRequestClient[],
    priorityFilters: FeatureRequestPriority[]
): FeatureRequestClient[] {
    // If no priority filters active, show all
    if (priorityFilters.length === 0) {
        return requests;
    }

    return requests.filter((request) => {
        // Include requests that match any of the selected priorities
        return request.priority && priorityFilters.includes(request.priority);
    });
}

/**
 * Filter by activity recency
 *
 * Options:
 * - recent: updated within last 7 days
 * - stale: no update >14 days
 */
export function filterByActivity(
    requests: FeatureRequestClient[],
    activityFilters: ('recent' | 'stale')[]
): FeatureRequestClient[] {
    // If no activity filters active, show all
    if (activityFilters.length === 0) {
        return requests;
    }

    const now = Date.now();

    return requests.filter((request) => {
        const updatedAt = new Date(request.updatedAt).getTime();
        const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);

        return activityFilters.some((filter) => {
            switch (filter) {
                case 'recent':
                    return daysSinceUpdate <= 7;

                case 'stale':
                    return daysSinceUpdate > 14;

                default:
                    return false;
            }
        });
    });
}

/**
 * Apply all filters to a list of feature requests
 *
 * Filters combine with AND logic (all conditions must match).
 * Within each filter category, options are OR logic (match any).
 */
export function applyAllFilters(
    requests: FeatureRequestClient[],
    filters: {
        statusFilters: string[];
        priorityFilters: FeatureRequestPriority[];
        activityFilters: ('recent' | 'stale')[];
    }
): FeatureRequestClient[] {
    // Apply filters in sequence (AND logic between categories)
    let filtered = requests;

    // Status filter
    filtered = filterByStatus(filtered, filters.statusFilters);

    // Priority filter
    filtered = filterByPriority(filtered, filters.priorityFilters);

    // Activity filter
    filtered = filterByActivity(filtered, filters.activityFilters);

    return filtered;
}
