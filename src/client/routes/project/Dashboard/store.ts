/**
 * Dashboard Store
 *
 * Zustand store for dashboard filters and state.
 * Uses createStore factory for automatic registration.
 */

import { createStore } from '@/client/stores';
import type { ActivityType, DateRangePreset } from './types';

interface DashboardState {
    // Date range filters
    startDate: Date;
    endDate: Date;

    // Activity feed filter
    activityTypeFilter: ActivityType | 'all';

    // Actions
    setDateRange: (start: Date, end: Date) => void;
    setActivityTypeFilter: (filter: ActivityType | 'all') => void;

    // Preset helpers
    setPreset: (preset: DateRangePreset) => void;
}

/**
 * Get date range for a preset
 */
function getPresetDates(preset: DateRangePreset): { start: Date; end: Date } {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (preset) {
        case 'last7days':
            start.setDate(start.getDate() - 7);
            break;
        case 'last30days':
            start.setDate(start.getDate() - 30);
            break;
        case 'last90days':
            start.setDate(start.getDate() - 90);
            break;
        case 'allTime':
            // Set to a very old date
            start.setFullYear(2020, 0, 1);
            break;
    }

    return { start, end };
}

// Default to last 30 days
const defaultDates = getPresetDates('last30days');

export const useDashboardStore = createStore<DashboardState>({
    key: 'dashboard-filters',
    label: 'Dashboard Filters',
    creator: (set) => ({
        startDate: defaultDates.start,
        endDate: defaultDates.end,
        activityTypeFilter: 'all',

        setDateRange: (start, end) => set({ startDate: start, endDate: end }),

        setActivityTypeFilter: (filter) => set({ activityTypeFilter: filter }),

        setPreset: (preset) => {
            const { start, end } = getPresetDates(preset);
            set({ startDate: start, endDate: end });
        },
    }),
    persistOptions: {
        partialize: (state) => ({
            // Persist dates as ISO strings for JSON serialization
            startDate: state.startDate,
            endDate: state.endDate,
            activityTypeFilter: state.activityTypeFilter,
        }),
        // Rehydrate dates from strings
        onRehydrateStorage: () => (state) => {
            if (state) {
                // Convert string dates back to Date objects if needed
                if (typeof state.startDate === 'string') {
                    state.startDate = new Date(state.startDate);
                }
                if (typeof state.endDate === 'string') {
                    state.endDate = new Date(state.endDate);
                }
            }
        },
    },
});
