import type { FeatureRequestClient, FeatureRequestStatus } from '@/apis/template/feature-requests/types';

interface StatusIndicatorStripProps {
    request: FeatureRequestClient;
    githubStatus?: string | null;
}

// Color mapping for GitHub statuses using semantic CSS variables
const githubStatusColors: Record<string, string> = {
    'backlog': 'hsl(var(--muted))',
    'todo': 'hsl(var(--primary))',
    'new': 'hsl(var(--primary))',
    'in progress': 'hsl(var(--warning))',
    'waiting for review': 'hsl(var(--warning))',
    'blocked': 'hsl(var(--destructive))',
    'done': 'hsl(var(--success))',
};

// Color mapping for database statuses using semantic CSS variables
const dbStatusColors: Record<FeatureRequestStatus, string> = {
    'new': 'hsl(var(--primary))',
    'in_progress': 'hsl(var(--warning))',
    'done': 'hsl(var(--success))',
    'rejected': 'hsl(var(--destructive))',
};

/**
 * Get status color based on GitHub status (if available) or database status (fallback)
 */
function getStatusColor(request: FeatureRequestClient, githubStatus?: string | null): string {
    // Use GitHub status if available
    if (request.githubProjectItemId && githubStatus) {
        return githubStatusColors[githubStatus.toLowerCase()] || 'hsl(var(--muted))';
    }

    // Fallback to DB status
    return dbStatusColors[request.status];
}

/**
 * 4px left-edge status indicator strip
 * Color represents GitHub Project status when linked, otherwise falls back to database status
 */
export function StatusIndicatorStrip({ request, githubStatus }: StatusIndicatorStripProps) {
    const color = getStatusColor(request, githubStatus);

    return (
        <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
            style={{ backgroundColor: color }}
            aria-hidden="true"
        />
    );
}
