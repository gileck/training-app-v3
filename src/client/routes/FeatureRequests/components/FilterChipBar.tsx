/**
 * FilterChipBar Component
 *
 * Multi-select filter chip bar for feature requests list.
 * Replaces traditional dropdown filters with toggleable chips for better scannability.
 */

import { Badge } from '@/client/components/ui/badge';
import { Button } from '@/client/components/ui/button';
import { X, Filter, GitBranch, GitPullRequest, Link2Off, Clock, CalendarClock } from 'lucide-react';
import { cn } from '@/client/lib/utils';
import type { FeatureRequestPriority } from '@/apis/feature-requests/types';

interface FilterChipBarProps {
    // Status filters
    statusFilters: string[];
    onToggleStatusFilter: (filter: string) => void;

    // Priority filters
    priorityFilters: FeatureRequestPriority[];
    onTogglePriorityFilter: (priority: FeatureRequestPriority) => void;

    // GitHub filters
    githubFilters: ('has_issue' | 'has_pr' | 'no_link')[];
    onToggleGitHubFilter: (filter: 'has_issue' | 'has_pr' | 'no_link') => void;

    // Activity filters
    activityFilters: ('recent' | 'stale')[];
    onToggleActivityFilter: (filter: 'recent' | 'stale') => void;

    // Clear all
    onClearAll: () => void;
}

interface FilterChipProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
    variant?: 'default' | 'priority';
    priorityLevel?: FeatureRequestPriority;
}

// Priority badge colors matching existing PriorityBadge component variants
const priorityColors: Record<FeatureRequestPriority, string> = {
    critical: 'bg-destructive text-destructive-foreground',
    high: 'bg-warning text-warning-foreground',
    medium: 'bg-primary text-primary-foreground',
    low: 'bg-secondary text-secondary-foreground',
};

function FilterChip({ label, isActive, onClick, icon, variant = 'default', priorityLevel }: FilterChipProps) {
    if (variant === 'priority' && priorityLevel) {
        // Priority chips with color preview
        return (
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                    'hover:scale-105 active:scale-95',
                    isActive
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background hover:bg-muted'
                )}
            >
                {/* Color preview dot */}
                <span className={cn('h-2 w-2 rounded-full', priorityColors[priorityLevel])} />
                <span>{label}</span>
                {isActive && <X className="h-3 w-3" />}
            </button>
        );
    }

    // Standard filter chips
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                'hover:scale-105 active:scale-95',
                isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background hover:bg-muted'
            )}
        >
            {icon}
            <span>{label}</span>
            {isActive && <X className="h-3 w-3" />}
        </button>
    );
}

export function FilterChipBar({
    statusFilters,
    onToggleStatusFilter,
    priorityFilters,
    onTogglePriorityFilter,
    githubFilters,
    onToggleGitHubFilter,
    activityFilters,
    onToggleActivityFilter,
    onClearAll,
}: FilterChipBarProps) {
    // Calculate total active filters
    const totalActiveFilters =
        statusFilters.length +
        priorityFilters.length +
        githubFilters.length +
        activityFilters.length;

    const hasActiveFilters = totalActiveFilters > 0;

    return (
        <div className="space-y-2">
            {/* Filter chip container with horizontal scroll on mobile */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {/* Status filters */}
                <FilterChip
                    label="Active"
                    isActive={statusFilters.includes('active')}
                    onClick={() => onToggleStatusFilter('active')}
                    icon={<Filter className="h-3 w-3" />}
                />
                <FilterChip
                    label="Waiting for Review"
                    isActive={statusFilters.includes('waiting_for_review')}
                    onClick={() => onToggleStatusFilter('waiting_for_review')}
                    icon={<Clock className="h-3 w-3" />}
                />
                <FilterChip
                    label="In Progress"
                    isActive={statusFilters.includes('in_progress')}
                    onClick={() => onToggleStatusFilter('in_progress')}
                    icon={<CalendarClock className="h-3 w-3" />}
                />
                <FilterChip
                    label="Blocked"
                    isActive={statusFilters.includes('blocked')}
                    onClick={() => onToggleStatusFilter('blocked')}
                    icon={<X className="h-3 w-3" />}
                />
                <FilterChip
                    label="Done"
                    isActive={statusFilters.includes('done')}
                    onClick={() => onToggleStatusFilter('done')}
                />
                <FilterChip
                    label="New"
                    isActive={statusFilters.includes('new')}
                    onClick={() => onToggleStatusFilter('new')}
                />

                {/* Visual separator */}
                <div className="h-6 w-px bg-border" />

                {/* Priority filters with color previews */}
                <FilterChip
                    label="Critical"
                    isActive={priorityFilters.includes('critical')}
                    onClick={() => onTogglePriorityFilter('critical')}
                    variant="priority"
                    priorityLevel="critical"
                />
                <FilterChip
                    label="High"
                    isActive={priorityFilters.includes('high')}
                    onClick={() => onTogglePriorityFilter('high')}
                    variant="priority"
                    priorityLevel="high"
                />
                <FilterChip
                    label="Medium"
                    isActive={priorityFilters.includes('medium')}
                    onClick={() => onTogglePriorityFilter('medium')}
                    variant="priority"
                    priorityLevel="medium"
                />
                <FilterChip
                    label="Low"
                    isActive={priorityFilters.includes('low')}
                    onClick={() => onTogglePriorityFilter('low')}
                    variant="priority"
                    priorityLevel="low"
                />

                {/* Visual separator */}
                <div className="h-6 w-px bg-border" />

                {/* GitHub filters */}
                <FilterChip
                    label="Has Issue"
                    isActive={githubFilters.includes('has_issue')}
                    onClick={() => onToggleGitHubFilter('has_issue')}
                    icon={<GitBranch className="h-3 w-3" />}
                />
                <FilterChip
                    label="Has PR"
                    isActive={githubFilters.includes('has_pr')}
                    onClick={() => onToggleGitHubFilter('has_pr')}
                    icon={<GitPullRequest className="h-3 w-3" />}
                />
                <FilterChip
                    label="No GitHub Link"
                    isActive={githubFilters.includes('no_link')}
                    onClick={() => onToggleGitHubFilter('no_link')}
                    icon={<Link2Off className="h-3 w-3" />}
                />

                {/* Visual separator */}
                <div className="h-6 w-px bg-border" />

                {/* Activity filters */}
                <FilterChip
                    label="Recent"
                    isActive={activityFilters.includes('recent')}
                    onClick={() => onToggleActivityFilter('recent')}
                    icon={<CalendarClock className="h-3 w-3" />}
                />
                <FilterChip
                    label="Stale"
                    isActive={activityFilters.includes('stale')}
                    onClick={() => onToggleActivityFilter('stale')}
                    icon={<Clock className="h-3 w-3" />}
                />
            </div>

            {/* Active filter summary and clear button */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                        <Filter className="h-3 w-3" />
                        {totalActiveFilters} {totalActiveFilters === 1 ? 'filter' : 'filters'} active
                    </Badge>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearAll}
                        className="h-7 px-2 text-xs"
                    >
                        Clear All
                    </Button>
                </div>
            )}
        </div>
    );
}
