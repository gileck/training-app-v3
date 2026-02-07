/**
 * MobileFilterSheet Component
 *
 * Bottom sheet drawer for mobile filter selection on feature requests list.
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/client/components/template/ui/sheet';
import { Button } from '@/client/components/template/ui/button';
import { Badge } from '@/client/components/template/ui/badge';
import { Separator } from '@/client/components/template/ui/separator';
import { Filter, X, GitBranch, Link2Off, Clock, CalendarClock } from 'lucide-react';
import { useIOSKeyboardOffset } from '@/client/lib/hooks';
import { FilterSection, FilterOption } from './FilterSheetHelpers';
import type { FeatureRequestPriority } from '@/apis/template/feature-requests/types';

interface MobileFilterSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    statusFilters: string[];
    onToggleStatusFilter: (filter: string) => void;
    priorityFilters: FeatureRequestPriority[];
    onTogglePriorityFilter: (priority: FeatureRequestPriority) => void;
    githubFilters: ('has_issue' | 'no_link')[];
    onToggleGitHubFilter: (filter: 'has_issue' | 'no_link') => void;
    activityFilters: ('recent' | 'stale')[];
    onToggleActivityFilter: (filter: 'recent' | 'stale') => void;
    onClearAll: () => void;
}

const priorityColors: Record<FeatureRequestPriority, string> = {
    critical: 'bg-destructive text-destructive-foreground',
    high: 'bg-warning text-warning-foreground',
    medium: 'bg-primary text-primary-foreground',
    low: 'bg-secondary text-secondary-foreground',
};

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
        statusFilters.length + priorityFilters.length + githubFilters.length + activityFilters.length;
    const hasActiveFilters = totalActiveFilters > 0;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="max-h-[85vh] overflow-y-auto rounded-t-xl px-4 pb-8 pt-4"
                style={{
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
                    <FilterSection title="Status">
                        <div className="grid grid-cols-2 gap-2">
                            <FilterOption label="Active" isActive={statusFilters.includes('active')} onClick={() => onToggleStatusFilter('active')} icon={<Filter className="h-4 w-4" />} />
                            <FilterOption label="Waiting Review" isActive={statusFilters.includes('waiting_for_review')} onClick={() => onToggleStatusFilter('waiting_for_review')} icon={<Clock className="h-4 w-4" />} />
                            <FilterOption label="In Progress" isActive={statusFilters.includes('in_progress')} onClick={() => onToggleStatusFilter('in_progress')} icon={<CalendarClock className="h-4 w-4" />} />
                            <FilterOption label="Blocked" isActive={statusFilters.includes('blocked')} onClick={() => onToggleStatusFilter('blocked')} icon={<X className="h-4 w-4" />} />
                            <FilterOption label="Done" isActive={statusFilters.includes('done')} onClick={() => onToggleStatusFilter('done')} />
                            <FilterOption label="New" isActive={statusFilters.includes('new')} onClick={() => onToggleStatusFilter('new')} />
                        </div>
                    </FilterSection>

                    <Separator />

                    <FilterSection title="Priority">
                        <div className="grid grid-cols-2 gap-2">
                            <FilterOption label="Critical" isActive={priorityFilters.includes('critical')} onClick={() => onTogglePriorityFilter('critical')} colorDot={priorityColors.critical} />
                            <FilterOption label="High" isActive={priorityFilters.includes('high')} onClick={() => onTogglePriorityFilter('high')} colorDot={priorityColors.high} />
                            <FilterOption label="Medium" isActive={priorityFilters.includes('medium')} onClick={() => onTogglePriorityFilter('medium')} colorDot={priorityColors.medium} />
                            <FilterOption label="Low" isActive={priorityFilters.includes('low')} onClick={() => onTogglePriorityFilter('low')} colorDot={priorityColors.low} />
                        </div>
                    </FilterSection>

                    <Separator />

                    <FilterSection title="GitHub" defaultExpanded={false}>
                        <div className="grid grid-cols-1 gap-2">
                            <FilterOption label="Has Issue" isActive={githubFilters.includes('has_issue')} onClick={() => onToggleGitHubFilter('has_issue')} icon={<GitBranch className="h-4 w-4" />} />
                            <FilterOption label="No GitHub Link" isActive={githubFilters.includes('no_link')} onClick={() => onToggleGitHubFilter('no_link')} icon={<Link2Off className="h-4 w-4" />} />
                        </div>
                    </FilterSection>

                    <Separator />

                    <FilterSection title="Activity" defaultExpanded={false}>
                        <div className="grid grid-cols-2 gap-2">
                            <FilterOption label="Recent" isActive={activityFilters.includes('recent')} onClick={() => onToggleActivityFilter('recent')} icon={<CalendarClock className="h-4 w-4" />} />
                            <FilterOption label="Stale" isActive={activityFilters.includes('stale')} onClick={() => onToggleActivityFilter('stale')} icon={<Clock className="h-4 w-4" />} />
                        </div>
                    </FilterSection>
                </div>

                <div className="mt-6 flex gap-3">
                    {hasActiveFilters && (
                        <Button variant="outline" className="flex-1" onClick={() => onClearAll()}>
                            Clear All
                        </Button>
                    )}
                    <Button className="flex-1" onClick={() => onOpenChange(false)}>
                        Apply Filters
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
