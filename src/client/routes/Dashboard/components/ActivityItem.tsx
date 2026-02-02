/**
 * Activity Item Component
 *
 * Single activity row in the activity feed with icon, title,
 * relative timestamp, and optional metadata.
 */

import {
    Lightbulb,
    Bug,
    Bot,
    GitPullRequest,
    CheckCircle,
    XCircle,
    Clock,
    GitMerge,
    Plus,
} from 'lucide-react';
import type { Activity, ActivityType, ActivityAction } from '../types';
import { formatRelativeTime } from '../../Todos/utils/dateUtils';
import { formatDurationSeconds, formatCurrency } from '../utils/mockData';

interface ActivityItemProps {
    activity: Activity;
}

/**
 * Get icon component for activity type and action
 */
function getActivityIcon(type: ActivityType, action: ActivityAction) {
    // Action-specific icons
    if (action === 'completed' || action === 'resolved' || action === 'approved') {
        return <CheckCircle className="h-4 w-4 text-success" />;
    }
    if (action === 'failed') {
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (action === 'merged') {
        return <GitMerge className="h-4 w-4 text-primary" />;
    }
    if (action === 'created') {
        return <Plus className="h-4 w-4 text-info" />;
    }

    // Type-specific icons (fallback)
    switch (type) {
        case 'feature_request':
            return <Lightbulb className="h-4 w-4 text-info" />;
        case 'bug_report':
            return <Bug className="h-4 w-4 text-destructive" />;
        case 'agent_execution':
            return <Bot className="h-4 w-4 text-primary" />;
        case 'pr':
            return <GitPullRequest className="h-4 w-4 text-success" />;
        default:
            return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
}

/**
 * Get background color class for activity type
 */
function getIconBgClass(type: ActivityType, action: ActivityAction): string {
    if (action === 'failed') {
        return 'bg-destructive/10';
    }
    if (action === 'completed' || action === 'resolved' || action === 'approved' || action === 'merged') {
        return 'bg-success/10';
    }

    switch (type) {
        case 'feature_request':
            return 'bg-info/10';
        case 'bug_report':
            return 'bg-destructive/10';
        case 'agent_execution':
            return 'bg-primary/10';
        case 'pr':
            return 'bg-success/10';
        default:
            return 'bg-muted';
    }
}

/**
 * Format metadata for display
 */
function formatMetadata(activity: Activity): string | null {
    const parts: string[] = [];

    if (activity.metadata?.agentType) {
        const displayName = activity.metadata.agentType
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        parts.push(displayName);
    }

    if (activity.metadata?.duration !== undefined) {
        parts.push(formatDurationSeconds(activity.metadata.duration));
    }

    if (activity.metadata?.cost !== undefined) {
        parts.push(formatCurrency(activity.metadata.cost));
    }

    return parts.length > 0 ? parts.join(' • ') : null;
}

export function ActivityItem({ activity }: ActivityItemProps) {
    const icon = getActivityIcon(activity.type, activity.action);
    const iconBgClass = getIconBgClass(activity.type, activity.action);
    const metadata = formatMetadata(activity);

    return (
        <div className="flex items-start gap-3 py-2">
            {/* Icon with background */}
            <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${iconBgClass}`}
            >
                {icon}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                {/* Title - truncate on mobile, show more on desktop */}
                <p className="text-sm font-medium leading-tight line-clamp-2 sm:line-clamp-1">
                    {activity.title}
                </p>

                {/* Timestamp and metadata */}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{formatRelativeTime(activity.timestamp)}</span>
                    {metadata && (
                        <>
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline">{metadata}</span>
                        </>
                    )}
                </div>

                {/* Mobile-only metadata (on separate line) */}
                {metadata && (
                    <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">{metadata}</p>
                )}
            </div>
        </div>
    );
}
