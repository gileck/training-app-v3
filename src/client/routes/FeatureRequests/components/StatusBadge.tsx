import { Badge } from '@/client/components/ui/badge';
import type { FeatureRequestStatus } from '@/apis/feature-requests/types';
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
