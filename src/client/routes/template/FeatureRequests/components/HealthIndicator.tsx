import type { FeatureRequestClient } from '@/apis/template/feature-requests/types';
import type { GetGitHubStatusResponse } from '@/apis/template/feature-requests/types';

type HealthStatus = 'healthy' | 'stale' | 'at_risk';

interface HealthIndicatorProps {
    request: FeatureRequestClient;
    githubStatus?: GetGitHubStatusResponse | null;
}

/**
 * Calculate health status based on updatedAt timestamp and current status
 *
 * Logic:
 * - At Risk: blocked >7 days OR no activity >30 days
 * - Stale: no activity >14 days
 * - Healthy: everything else
 */
function calculateHealth(
    request: FeatureRequestClient,
    githubStatus?: GetGitHubStatusResponse | null
): HealthStatus {
    const daysSinceUpdate =
        (Date.now() - new Date(request.updatedAt).getTime()) / (1000 * 60 * 60 * 24);

    // Check if blocked (either DB status or GitHub status)
    const isBlocked =
        request.status === 'rejected' ||
        githubStatus?.status?.toLowerCase() === 'blocked';

    // At Risk: blocked >7 days OR no activity >30 days
    if (isBlocked && daysSinceUpdate > 7) return 'at_risk';
    if (daysSinceUpdate > 30) return 'at_risk';

    // Stale: no activity >14 days
    if (daysSinceUpdate > 14) return 'stale';

    // Healthy: everything else
    return 'healthy';
}

/**
 * Health indicator component showing visual dot with tooltip
 * Only shown in expanded card view
 */
export function HealthIndicator({ request, githubStatus }: HealthIndicatorProps) {
    const health = calculateHealth(request, githubStatus);

    // Don't show anything for healthy items (reduces noise)
    if (health === 'healthy') return null;

    const healthConfig = {
        healthy: {
            label: 'Healthy',
            description: 'No action needed',
            colorClass: 'bg-success',
        },
        stale: {
            label: 'Stale',
            description: 'No activity for more than 14 days',
            colorClass: 'bg-warning',
        },
        at_risk: {
            label: 'At Risk',
            description:
                request.status === 'rejected' ||
                githubStatus?.status?.toLowerCase() === 'blocked'
                    ? 'Blocked for more than 7 days'
                    : 'No activity for more than 30 days',
            colorClass: 'bg-destructive',
        },
    };

    const config = healthConfig[health];

    return (
        <div className="rounded-lg bg-muted/20 p-3 transition-all duration-200 ease-out">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${config.colorClass}`} />
                    <span className="font-medium">{config.label}</span>
                </div>
                <span className="text-muted-foreground">—</span>
                <span>{config.description}</span>
            </div>
        </div>
    );
}
