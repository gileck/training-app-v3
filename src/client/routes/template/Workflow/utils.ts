/**
 * Workflow Utilities
 *
 * Shared formatting functions used across workflow components.
 */

import { WORKFLOW_HISTORY_ACTIONS } from '@/apis/template/workflow/types';

export function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatAction(action: string): string {
    return (WORKFLOW_HISTORY_ACTIONS as Record<string, string>)[action]
        ?? action.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function formatRelativeTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
