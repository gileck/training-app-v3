import type { FeatureRequestClient, FeatureRequestStatus } from '@/apis/template/feature-requests/types';

interface StatusIndicatorStripProps {
    request: FeatureRequestClient;
}

// Color mapping for native statuses using semantic CSS variables
const statusColors: Record<FeatureRequestStatus, string> = {
    'new': 'hsl(var(--primary))',
    'in_progress': 'hsl(var(--warning))',
    'done': 'hsl(var(--success))',
    'rejected': 'hsl(var(--destructive))',
};

/**
 * 4px left-edge status indicator strip
 * Color represents the feature request's native status.
 */
export function StatusIndicatorStrip({ request }: StatusIndicatorStripProps) {
    const color = statusColors[request.status] ?? 'hsl(var(--muted))';

    return (
        <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
            style={{ backgroundColor: color }}
            aria-hidden="true"
        />
    );
}
