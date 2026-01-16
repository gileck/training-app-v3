/**
 * Active Filters Summary Bar
 */

import { X } from 'lucide-react';
import type { FilterSource } from '../../../store';

interface ActiveFiltersBarProps {
    filterSource: FilterSource;
    filterMuscle: string;
    filterType: string;
    onClearFilters: () => void;
}

export function ActiveFiltersBar({
    filterSource,
    filterMuscle,
    filterType,
    onClearFilters,
}: ActiveFiltersBarProps) {
    const activeFilters = [
        filterSource === 'system' ? 'Library' : filterSource === 'custom' ? 'Custom' : null,
        filterMuscle !== 'all' ? filterMuscle : null,
        filterType !== 'all' ? filterType : null
    ].filter(Boolean);

    if (activeFilters.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <span className="font-medium">Filters:</span>
            <span>{activeFilters.join(' • ')}</span>
            <button
                onClick={onClearFilters}
                className="h-5 w-5 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center transition-colors"
                aria-label="Clear filters"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    );
}
