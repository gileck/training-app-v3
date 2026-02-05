import { Badge } from '@/client/components/template/ui/badge';
import type { FeatureRequestStatus } from '@/apis/template/feature-requests/types';
import {
    CircleDot,
    Hammer,
    CheckCircle,
    XCircle,
} from 'lucide-react';

interface StatusBadgeProps {
    status: FeatureRequestStatus;
}

const statusConfig: Record<
    FeatureRequestStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; icon: React.ReactNode }
> = {
    new: { label: 'New', variant: 'default', icon: <CircleDot className="h-3 w-3" /> },
    in_progress: { label: 'In Progress', variant: 'warning', icon: <Hammer className="h-3 w-3" /> },
    done: { label: 'Done', variant: 'success', icon: <CheckCircle className="h-3 w-3" /> },
    rejected: { label: 'Rejected', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

const unknownConfig = { label: 'Unknown', variant: 'outline' as const, icon: <CircleDot className="h-3 w-3" /> };

export function StatusBadge({ status }: StatusBadgeProps) {
    const config = statusConfig[status] ?? unknownConfig;

    return (
        <Badge variant={config.variant} className="gap-1">
            {config.icon}
            {config.label}
        </Badge>
    );
}

interface PriorityBadgeProps {
    priority?: 'low' | 'medium' | 'high' | 'critical';
}

const priorityConfig: Record<
    'low' | 'medium' | 'high' | 'critical',
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }
> = {
    low: { label: 'Low', variant: 'secondary' },
    medium: { label: 'Medium', variant: 'default' },
    high: { label: 'High', variant: 'warning' },
    critical: { label: 'Critical', variant: 'destructive' },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
    if (!priority) return null;

    const config = priorityConfig[priority];

    return (
        <Badge variant={config.variant}>
            {config.label}
        </Badge>
    );
}

interface GitHubStatusBadgeProps {
    status: string;
    reviewStatus?: string | null;
}

/**
 * Badge for GitHub Project statuses
 * Maps common GitHub statuses to appropriate badge variants
 * Displays review status inline with main status
 */
export function GitHubStatusBadge({ status, reviewStatus }: GitHubStatusBadgeProps) {
    // Map GitHub status to badge variant
    const getVariant = (githubStatus: string): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' => {
        const statusLower = githubStatus.toLowerCase();

        if (statusLower === 'backlog') return 'secondary';
        if (statusLower === 'todo' || statusLower === 'new') return 'default';
        if (statusLower === 'in progress') return 'warning';
        if (statusLower === 'waiting for review') return 'warning';
        if (statusLower === 'blocked') return 'destructive';
        if (statusLower === 'done') return 'success';

        return 'outline'; // fallback
    };

    // Get appropriate icon for status
    const getIcon = (githubStatus: string) => {
        const statusLower = githubStatus.toLowerCase();

        if (statusLower === 'done') return <CheckCircle className="h-3 w-3" />;
        if (statusLower === 'in progress') return <Hammer className="h-3 w-3" />;
        if (statusLower === 'blocked') return <XCircle className="h-3 w-3" />;

        return <CircleDot className="h-3 w-3" />;
    };

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant={getVariant(status)} className="gap-1">
                {getIcon(status)}
                {status}
            </Badge>
            {reviewStatus && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    ({reviewStatus})
                </span>
            )}
        </div>
    );
}
