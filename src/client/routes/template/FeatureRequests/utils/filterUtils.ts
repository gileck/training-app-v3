/**
 * Filter Utility Functions
 *
 * Client-side filtering logic for feature requests list.
 * Supports multi-select filters across status, priority, GitHub linkage, and activity.
 */

import type {
    FeatureRequestClient,
    FeatureRequestPriority,
} from '@/apis/feature-requests/types';
import type { GetGitHubStatusResponse } from '@/apis/feature-requests/types';

/**
 * Filter by GitHub status
 *
 * Maps UI filter labels to actual GitHub statuses from API.
 * Handles both GitHub Project status and database status.
 */
export function filterByGitHubStatus(
    requests: FeatureRequestClient[],
    statusFilters: string[],
    githubStatusMap: Record<string, GetGitHubStatusResponse | undefined>
): FeatureRequestClient[] {
    // If no status filters active, show all
    if (statusFilters.length === 0) {
        return requests;
    }

    return requests.filter((request) => {
        const githubStatus = githubStatusMap[request._id];
        const effectiveStatus = getEffectiveStatus(request, githubStatus);

        // Check if request matches any of the active status filters
        return statusFilters.some((filter) => {
            switch (filter) {
                case 'active':
                    // Active = not Done or Rejected
                    // Check BOTH DB status and GitHub status to handle stale cache
                    if (request.status === 'done' || request.status === 'rejected') {
                        return false;
                    }
                    return !['done', 'rejected'].includes(effectiveStatus.toLowerCase());

                case 'waiting_for_review':
                    // Waiting for Review = GitHub status OR reviewStatus contains "review"
                    if (githubStatus?.reviewStatus) {
                        return githubStatus.reviewStatus.toLowerCase().includes('review');
                    }
                    return effectiveStatus.toLowerCase().includes('review');

                case 'in_progress':
                    // In Progress = DB status or GitHub status contains "progress"
                    if (request.status === 'in_progress') return true;
                    return effectiveStatus.toLowerCase().includes('progress');

                case 'blocked':
                    // Blocked = status contains "blocked"
                    return effectiveStatus.toLowerCase().includes('blocked');

                case 'done':
                    // Done = DB status done OR GitHub status done
                    if (request.status === 'done') return true;
                    return effectiveStatus.toLowerCase() === 'done';

                case 'new':
                    // New = DB status new OR GitHub status backlog
                    if (request.status === 'new') return true;
                    return effectiveStatus.toLowerCase() === 'backlog';

                default:
                    return false;
            }
        });
    });
}

/**
 * Get effective status for a request (GitHub takes priority over DB)
 */
function getEffectiveStatus(
    request: FeatureRequestClient,
    githubStatus?: GetGitHubStatusResponse
): string {
    if (request.githubProjectItemId && githubStatus?.status) {
        return githubStatus.status;
    }
    return request.status;
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
 * Filter by GitHub linkage
 *
 * Options: has_issue, no_link
 */
export function filterByGitHubLinkage(
    requests: FeatureRequestClient[],
    githubFilters: ('has_issue' | 'no_link')[]
): FeatureRequestClient[] {
    // If no GitHub filters active, show all
    if (githubFilters.length === 0) {
        return requests;
    }

    return requests.filter((request) => {
        return githubFilters.some((filter) => {
            switch (filter) {
                case 'has_issue':
                    return !!request.githubIssueUrl;

                case 'no_link':
                    return !request.githubIssueUrl;

                default:
                    return false;
            }
        });
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
        githubFilters: ('has_issue' | 'no_link')[];
        activityFilters: ('recent' | 'stale')[];
    },
    githubStatusMap: Record<string, GetGitHubStatusResponse | undefined>
): FeatureRequestClient[] {
    // Apply filters in sequence (AND logic between categories)
    let filtered = requests;

    // Status filter
    filtered = filterByGitHubStatus(filtered, filters.statusFilters, githubStatusMap);

    // Priority filter
    filtered = filterByPriority(filtered, filters.priorityFilters);

    // GitHub linkage filter
    filtered = filterByGitHubLinkage(filtered, filters.githubFilters);

    // Activity filter
    filtered = filterByActivity(filtered, filters.activityFilters);

    return filtered;
}
