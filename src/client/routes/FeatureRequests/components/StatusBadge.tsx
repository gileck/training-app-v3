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
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
    new: { label: 'New', variant: 'default', icon: <CircleDot className="h-3 w-3" /> },
    in_progress: { label: 'In Progress', variant: 'secondary', icon: <Hammer className="h-3 w-3" /> },
    done: { label: 'Done', variant: 'outline', icon: <CheckCircle className="h-3 w-3 text-green-500" /> },
    rejected: { label: 'Rejected', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
};

export function StatusBadge({ status }: StatusBadgeProps) {
    const config = statusConfig[status];

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
    { label: string; className: string }
> = {
    low: { label: 'Low', className: 'bg-gray-100 text-gray-600' },
    medium: { label: 'Medium', className: 'bg-blue-100 text-blue-600' },
    high: { label: 'High', className: 'bg-orange-100 text-orange-600' },
    critical: { label: 'Critical', className: 'bg-red-100 text-red-600' },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
    if (!priority) return null;

    const config = priorityConfig[priority];

    return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}>
            {config.label}
        </span>
    );
}
