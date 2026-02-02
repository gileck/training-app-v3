/**
 * Generate Activities Utility
 *
 * Utility for filtering activities by type on the client side.
 * The actual activity generation happens server-side for consistency.
 */

import type { Activity, ActivityType } from '../types';

/**
 * Filter activities by type
 * @param activities - Array of activities to filter
 * @param filter - Activity type filter ('all' or specific type)
 * @returns Filtered activities array
 */
export function filterActivities(
    activities: Activity[],
    filter: ActivityType | 'all'
): Activity[] {
    if (filter === 'all') {
        return activities;
    }
    return activities.filter((activity) => activity.type === filter);
}

/**
 * Get display label for activity type
 */
export function getActivityTypeLabel(type: ActivityType | 'all'): string {
    const labels: Record<ActivityType | 'all', string> = {
        all: 'All',
        feature_request: 'Features',
        bug_report: 'Bugs',
        agent_execution: 'Agents',
        pr: 'PRs',
    };
    return labels[type];
}

/**
 * Get all activity type filter options
 */
export function getActivityTypeOptions(): Array<{ value: ActivityType | 'all'; label: string }> {
    return [
        { value: 'all', label: 'All' },
        { value: 'feature_request', label: 'Features' },
        { value: 'bug_report', label: 'Bugs' },
        { value: 'agent_execution', label: 'Agents' },
        { value: 'pr', label: 'PRs' },
    ];
}
