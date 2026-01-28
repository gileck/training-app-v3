/**
 * MobileFilterSheet Component
 *
 * Bottom sheet drawer for mobile filter selection on feature requests list.
 * Groups filters into collapsible sections for better mobile UX.
 *
 * Responsive behavior:
 * - Only rendered on mobile (<sm breakpoint, 640px)
 * - Opens from bottom with 85vh max height
 * - Scrollable content with sticky footer actions
 *
 * Filter categories:
 * - Status: active, waiting_for_review, in_progress, blocked, done, new
 * - Priority: critical, high, medium, low (with color dots matching PriorityBadge)
 * - GitHub: has_issue, no_link (collapsed by default)
 * - Activity: recent, stale (collapsed by default)
 *
 * iOS PWA support:
 * - Uses useIOSKeyboardOffset hook to handle iOS keyboard overlay
 * - Sheet content transforms up when keyboard opens (future-proofing for text inputs)
 *
 * @see FilterChipBar - Parent component that controls when this sheet opens
 * @see docs/ios-pwa-fixes.md - iOS keyboard handling documentation
 */

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/client/components/ui/sheet';
import { Button } from '@/client/components/ui/button';
import { Badge } from '@/client/components/ui/badge';
import { Separator } from '@/client/components/ui/separator';
import {
    Filter,
    X,
    ChevronDown,
    ChevronUp,
    GitBranch,
    Link2Off,
    Clock,
    CalendarClock,
} from 'lucide-react';
import { cn } from '@/client/lib/utils';
import { useIOSKeyboardOffset } from '@/client/lib/hooks';
import type { FeatureRequestPriority } from '@/apis/feature-requests/types';

interface MobileFilterSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;

    // Status filters
    statusFilters: string[];
    onToggleStatusFilter: (filter: string) => void;

    // Priority filters
    priorityFilters: FeatureRequestPriority[];
    onTogglePriorityFilter: (priority: FeatureRequestPriority) => void;

    // GitHub filters
    githubFilters: ('has_issue' | 'no_link')[];
    onToggleGitHubFilter: (filter: 'has_issue' | 'no_link') => void;

    // Activity filters
    activityFilters: ('recent' | 'stale')[];
    onToggleActivityFilter: (filter: 'recent' | 'stale') => void;

    // Clear all
    onClearAll: () => void;
}

// Priority badge colors matching existing PriorityBadge component variants
const priorityColors: Record<FeatureRequestPriority, string> = {
    critical: 'bg-destructive text-destructive-foreground',
    high: 'bg-warning text-warning-foreground',
    medium: 'bg-primary text-primary-foreground',
    low: 'bg-secondary text-secondary-foreground',
};

interface FilterSectionProps {
    title: string;
    defaultExpanded?: boolean;
    children: React.ReactNode;
}

function FilterSection({ title, defaultExpanded = true, children }: FilterSectionProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex w-full items-center justify-between py-2 text-sm font-medium text-foreground"
            >
                {title}
                {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
            </button>
            {isExpanded && <div className="pb-2">{children}</div>}
        </div>
    );
}

interface FilterOptionProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon?: React.ReactNode;
    colorDot?: string;
}

function FilterOption({ label, isActive, onClick, icon, colorDot }: FilterOptionProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-foreground hover:bg-muted'
            )}
        >
            {colorDot && <span className={cn('h-3 w-3 rounded-full flex-shrink-0', colorDot)} />}
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span className="flex-1 text-left">{label}</span>
            {isActive && <X className="h-4 w-4 flex-shrink-0" />}
        </button>
    );
}

export function MobileFilterSheet({
    open,
    onOpenChange,
    statusFilters,
    onToggleStatusFilter,
    priorityFilters,
    onTogglePriorityFilter,
    githubFilters,
    onToggleGitHubFilter,
    activityFilters,
    onToggleActivityFilter,
    onClearAll,
}: MobileFilterSheetProps) {
    const keyboardOffset = useIOSKeyboardOffset();

    const totalActiveFilters =
        statusFilters.length +
        priorityFilters.length +
        githubFilters.length +
        activityFilters.length;

    const hasActiveFilters = totalActiveFilters > 0;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="max-h-[85vh] overflow-y-auto rounded-t-xl px-4 pb-8 pt-4"
                style={{
                    // Push sheet up when iOS keyboard is open (future-proofing for text inputs)
                    transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
                    transition: 'transform 0.1s ease-out',
                }}
            >
                <SheetHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters
                            {hasActiveFilters && (
                                <Badge variant="secondary" className="ml-1">
                                    {totalActiveFilters}
                                </Badge>
                            )}
                        </SheetTitle>
                        <SheetClose asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <X className="h-5 w-5" />
                            </Button>
                        </SheetClose>
                    </div>
                </SheetHeader>

                <div className="space-y-1">
                    {/* Status Filters */}
                    <FilterSection title="Status">
                        <div className="grid grid-cols-2 gap-2">
                            <FilterOption
                                label="Active"
                                isActive={statusFilters.includes('active')}
                                onClick={() => onToggleStatusFilter('active')}
                                icon={<Filter className="h-4 w-4" />}
                            />
                            <FilterOption
                                label="Waiting Review"
                                isActive={statusFilters.includes('waiting_for_review')}
                                onClick={() => onToggleStatusFilter('waiting_for_review')}
                                icon={<Clock className="h-4 w-4" />}
                            />
                            <FilterOption
                                label="In Progress"
                                isActive={statusFilters.includes('in_progress')}
                                onClick={() => onToggleStatusFilter('in_progress')}
                                icon={<CalendarClock className="h-4 w-4" />}
                            />
                            <FilterOption
                                label="Blocked"
                                isActive={statusFilters.includes('blocked')}
                                onClick={() => onToggleStatusFilter('blocked')}
                                icon={<X className="h-4 w-4" />}
                            />
                            <FilterOption
                                label="Done"
                                isActive={statusFilters.includes('done')}
                                onClick={() => onToggleStatusFilter('done')}
                            />
                            <FilterOption
                                label="New"
                                isActive={statusFilters.includes('new')}
                                onClick={() => onToggleStatusFilter('new')}
                            />
                        </div>
                    </FilterSection>

                    <Separator />

                    {/* Priority Filters */}
                    <FilterSection title="Priority">
                        <div className="grid grid-cols-2 gap-2">
                            <FilterOption
                                label="Critical"
                                isActive={priorityFilters.includes('critical')}
                                onClick={() => onTogglePriorityFilter('critical')}
                                colorDot={priorityColors.critical}
                            />
                            <FilterOption
                                label="High"
                                isActive={priorityFilters.includes('high')}
                                onClick={() => onTogglePriorityFilter('high')}
                                colorDot={priorityColors.high}
                            />
                            <FilterOption
                                label="Medium"
                                isActive={priorityFilters.includes('medium')}
                                onClick={() => onTogglePriorityFilter('medium')}
                                colorDot={priorityColors.medium}
                            />
                            <FilterOption
                                label="Low"
                                isActive={priorityFilters.includes('low')}
                                onClick={() => onTogglePriorityFilter('low')}
                                colorDot={priorityColors.low}
                            />
                        </div>
                    </FilterSection>

                    <Separator />

                    {/* GitHub Filters */}
                    <FilterSection title="GitHub" defaultExpanded={false}>
                        <div className="grid grid-cols-1 gap-2">
                            <FilterOption
                                label="Has Issue"
                                isActive={githubFilters.includes('has_issue')}
                                onClick={() => onToggleGitHubFilter('has_issue')}
                                icon={<GitBranch className="h-4 w-4" />}
                            />
                            <FilterOption
                                label="No GitHub Link"
                                isActive={githubFilters.includes('no_link')}
                                onClick={() => onToggleGitHubFilter('no_link')}
                                icon={<Link2Off className="h-4 w-4" />}
                            />
                        </div>
                    </FilterSection>

                    <Separator />

                    {/* Activity Filters */}
                    <FilterSection title="Activity" defaultExpanded={false}>
                        <div className="grid grid-cols-2 gap-2">
                            <FilterOption
                                label="Recent"
                                isActive={activityFilters.includes('recent')}
                                onClick={() => onToggleActivityFilter('recent')}
                                icon={<CalendarClock className="h-4 w-4" />}
                            />
                            <FilterOption
                                label="Stale"
                                isActive={activityFilters.includes('stale')}
                                onClick={() => onToggleActivityFilter('stale')}
                                icon={<Clock className="h-4 w-4" />}
                            />
                        </div>
                    </FilterSection>
                </div>

                {/* Footer Actions */}
                <div className="mt-6 flex gap-3">
                    {hasActiveFilters && (
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                                onClearAll();
                            }}
                        >
                            Clear All
                        </Button>
                    )}
                    <Button
                        className="flex-1"
                        onClick={() => onOpenChange(false)}
                    >
                        Apply Filters
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
