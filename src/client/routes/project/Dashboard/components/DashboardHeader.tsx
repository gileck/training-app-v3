/**
 * Dashboard Header Component
 *
 * Header with title, date range preset buttons, and export button.
 */

import { Button } from '@/client/components/template/ui/button';
import { ExportButton } from './ExportButton';
import { useDashboardStore } from '../store';
import { useDashboardAnalytics } from '../hooks';
import type { DateRangePreset } from '../types';

/**
 * Date range preset options
 */
const presets: { value: DateRangePreset; label: string }[] = [
    { value: 'last7days', label: '7 Days' },
    { value: 'last30days', label: '30 Days' },
    { value: 'last90days', label: '90 Days' },
    { value: 'allTime', label: 'All Time' },
];

/**
 * Get the current preset based on date range
 */
function getCurrentPreset(startDate: Date, endDate: Date): DateRangePreset | null {
    const now = new Date();
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check if end date is today (within 1 day)
    const isEndToday = Math.abs(now.getTime() - endDate.getTime()) < 2 * 24 * 60 * 60 * 1000;

    if (!isEndToday) return null;

    if (daysDiff >= 6 && daysDiff <= 8) return 'last7days';
    if (daysDiff >= 29 && daysDiff <= 31) return 'last30days';
    if (daysDiff >= 89 && daysDiff <= 91) return 'last90days';
    if (daysDiff > 365) return 'allTime';

    return null;
}

export function DashboardHeader() {
    const startDate = useDashboardStore((s) => s.startDate);
    const endDate = useDashboardStore((s) => s.endDate);
    const setPreset = useDashboardStore((s) => s.setPreset);
    const { data } = useDashboardAnalytics();

    const currentPreset = getCurrentPreset(startDate, endDate);

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-semibold">Analytics Dashboard</h1>

            {/* Date range presets and export */}
            <div className="flex flex-wrap items-center gap-2">
                {presets.map((preset) => (
                    <Button
                        key={preset.value}
                        variant={currentPreset === preset.value ? 'default' : 'outline'}
                        size="sm"
                        className="h-9 min-w-[70px]"
                        onClick={() => setPreset(preset.value)}
                    >
                        {preset.label}
                    </Button>
                ))}
                <div className="hidden sm:block w-px h-6 bg-border mx-1" />
                <ExportButton metrics={data} startDate={startDate} endDate={endDate} />
            </div>
        </div>
    );
}
