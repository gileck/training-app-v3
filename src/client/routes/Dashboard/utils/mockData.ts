/**
 * Mock Data Utilities
 *
 * Utility functions for formatting and transforming dashboard data.
 */

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
        return `${seconds}s`;
    }

    return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDurationSeconds(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (minutes === 0) {
        return `${remainingSeconds}s`;
    }

    return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
}

/**
 * Format percentage value
 */
export function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
}

/**
 * Format date for chart axis labels
 */
export function formatChartDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format week start date for chart labels
 */
export function formatWeekLabel(dateStr: string): string {
    const date = new Date(dateStr);
    return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/**
 * Get display name for agent type
 */
export function getAgentDisplayName(agentType: string): string {
    const displayNames: Record<string, string> = {
        'tech-design': 'Tech Design',
        implement: 'Implement',
        'pr-review': 'PR Review',
        other: 'Other',
    };
    return displayNames[agentType] || agentType;
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: string): string {
    const displayNames: Record<string, string> = {
        new: 'New',
        in_progress: 'In Progress',
        done: 'Done',
        rejected: 'Rejected',
        investigating: 'Investigating',
        resolved: 'Resolved',
        closed: 'Closed',
    };
    return displayNames[status] || status;
}
