import { Badge } from '@/client/components/ui/badge';
import type { FeatureRequestStatus, DesignReviewStatus } from '@/apis/feature-requests/types';
import {
    CircleDot,
    Search,
    Palette,
    Code,
    Rocket,
    Hammer,
    TestTube,
    CheckCircle,
    XCircle,
    Pause,
    Clock,
    CheckCheck,
    AlertCircle,
} from 'lucide-react';

interface StatusBadgeProps {
    status: FeatureRequestStatus;
    reviewStatus?: DesignReviewStatus;
}

const statusConfig: Record<
    FeatureRequestStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }
> = {
    new: { label: 'New', variant: 'default', icon: <CircleDot className="h-3 w-3" /> },
    in_review: { label: 'In Review', variant: 'secondary', icon: <Search className="h-3 w-3" /> },
    product_design: { label: 'Product Design', variant: 'secondary', icon: <Palette className="h-3 w-3" /> },
    tech_design: { label: 'Tech Design', variant: 'secondary', icon: <Code className="h-3 w-3" /> },
    ready_for_dev: { label: 'Ready for Dev', variant: 'default', icon: <Rocket className="h-3 w-3" /> },
    in_development: { label: 'In Development', variant: 'secondary', icon: <Hammer className="h-3 w-3" /> },
    ready_for_qa: { label: 'Ready for QA', variant: 'secondary', icon: <TestTube className="h-3 w-3" /> },
    done: { label: 'Done', variant: 'outline', icon: <CheckCircle className="h-3 w-3 text-green-500" /> },
    rejected: { label: 'Rejected', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    on_hold: { label: 'On Hold', variant: 'outline', icon: <Pause className="h-3 w-3" /> },
};

const reviewStatusConfig: Record<
    DesignReviewStatus,
    { label: string; icon: React.ReactNode; className: string }
> = {
    not_started: { label: 'Not Started', icon: <Clock className="h-3 w-3" />, className: 'text-muted-foreground' },
    in_progress: { label: 'In Progress', icon: <Hammer className="h-3 w-3" />, className: 'text-blue-500' },
    pending_review: { label: 'Pending Review', icon: <AlertCircle className="h-3 w-3" />, className: 'text-yellow-500' },
    approved: { label: 'Approved', icon: <CheckCheck className="h-3 w-3" />, className: 'text-green-500' },
    rejected: { label: 'Needs Rework', icon: <XCircle className="h-3 w-3" />, className: 'text-red-500' },
};

export function StatusBadge({ status, reviewStatus }: StatusBadgeProps) {
    const config = statusConfig[status];

    return (
        <div className="flex items-center gap-2">
            <Badge variant={config.variant} className="gap-1">
                {config.icon}
                {config.label}
            </Badge>
            {reviewStatus && (status === 'product_design' || status === 'tech_design') && (
                <span className={`flex items-center gap-1 text-xs ${reviewStatusConfig[reviewStatus].className}`}>
                    {reviewStatusConfig[reviewStatus].icon}
                    {reviewStatusConfig[reviewStatus].label}
                </span>
            )}
        </div>
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
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
            {config.label}
        </span>
    );
}
