/**
 * FilterChipBar Component
 *
 * Multi-select filter chip bar for feature requests list.
 * Mobile: Shows "Filters" button opening MobileFilterSheet.
 * Desktop: Shows horizontal scrolling filter chips.
 */

import { useState } from 'react';
import { Badge } from '@/client/components/template/ui/badge';
import { Button } from '@/client/components/template/ui/button';
import { Filter, Clock, CalendarClock, SlidersHorizontal } from 'lucide-react';
import type { FeatureRequestPriority } from '@/apis/template/feature-requests/types';
import { MobileFilterSheet } from './MobileFilterSheet';
import { FilterChipButton } from './FilterChipButton';

interface FilterChipBarProps {
    statusFilters: string[];
    onToggleStatusFilter: (filter: string) => void;
    priorityFilters: FeatureRequestPriority[];
    onTogglePriorityFilter: (priority: FeatureRequestPriority) => void;
    activityFilters: ('recent' | 'stale')[];
    onToggleActivityFilter: (filter: 'recent' | 'stale') => void;
    onClearAll: () => void;
}

export function FilterChipBar({
    statusFilters,
    onToggleStatusFilter,
    priorityFilters,
    onTogglePriorityFilter,
    activityFilters,
    onToggleActivityFilter,
    onClearAll,
}: FilterChipBarProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

    const totalActiveFilters =
        statusFilters.length + priorityFilters.length + activityFilters.length;
    const hasActiveFilters = totalActiveFilters > 0;

    return (
        <>
            {/* Mobile: Compact filter button */}
            <div className="sm:hidden">
                <Button variant="outline" size="sm" onClick={() => setIsFilterSheetOpen(true)} className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>Filters</span>
                    {hasActiveFilters && (
                        <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                            {totalActiveFilters}
                        </Badge>
                    )}
                </Button>
            </div>

            {/* Desktop: Full filter chip bar */}
            <div className="hidden sm:block space-y-2 flex-1">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <FilterChipButton label="Active" isActive={statusFilters.includes('active')} onClick={() => onToggleStatusFilter('active')} icon={<Filter className="h-3 w-3" />} />
                    <FilterChipButton label="New" isActive={statusFilters.includes('new')} onClick={() => onToggleStatusFilter('new')} />
                    <FilterChipButton label="In Progress" isActive={statusFilters.includes('in_progress')} onClick={() => onToggleStatusFilter('in_progress')} icon={<CalendarClock className="h-3 w-3" />} />
                    <FilterChipButton label="Done" isActive={statusFilters.includes('done')} onClick={() => onToggleStatusFilter('done')} />
                    <FilterChipButton label="Rejected" isActive={statusFilters.includes('rejected')} onClick={() => onToggleStatusFilter('rejected')} />

                    <div className="h-6 w-px bg-border" />

                    <FilterChipButton label="Critical" isActive={priorityFilters.includes('critical')} onClick={() => onTogglePriorityFilter('critical')} variant="priority" priorityLevel="critical" />
                    <FilterChipButton label="High" isActive={priorityFilters.includes('high')} onClick={() => onTogglePriorityFilter('high')} variant="priority" priorityLevel="high" />
                    <FilterChipButton label="Medium" isActive={priorityFilters.includes('medium')} onClick={() => onTogglePriorityFilter('medium')} variant="priority" priorityLevel="medium" />
                    <FilterChipButton label="Low" isActive={priorityFilters.includes('low')} onClick={() => onTogglePriorityFilter('low')} variant="priority" priorityLevel="low" />

                    <div className="h-6 w-px bg-border" />

                    <FilterChipButton label="Recent" isActive={activityFilters.includes('recent')} onClick={() => onToggleActivityFilter('recent')} icon={<CalendarClock className="h-3 w-3" />} />
                    <FilterChipButton label="Stale" isActive={activityFilters.includes('stale')} onClick={() => onToggleActivityFilter('stale')} icon={<Clock className="h-3 w-3" />} />
                </div>

                {hasActiveFilters && (
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                            <Filter className="h-3 w-3" />
                            {totalActiveFilters} {totalActiveFilters === 1 ? 'filter' : 'filters'} active
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={onClearAll} className="h-7 px-2 text-xs">
                            Clear All
                        </Button>
                    </div>
                )}
            </div>

            <MobileFilterSheet
                open={isFilterSheetOpen}
                onOpenChange={setIsFilterSheetOpen}
                statusFilters={statusFilters}
                onToggleStatusFilter={onToggleStatusFilter}
                priorityFilters={priorityFilters}
                onTogglePriorityFilter={onTogglePriorityFilter}
                activityFilters={activityFilters}
                onToggleActivityFilter={onToggleActivityFilter}
                onClearAll={onClearAll}
            />
        </>
    );
}
