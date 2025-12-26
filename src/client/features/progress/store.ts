import { createStore } from '@/client/stores';
import type { ProgressState, ProgressTab, DateRange } from './types';

/**
 * Progress store - persists active tab and date range selection across sessions
 */
export const useProgressStore = createStore<ProgressState>({
    key: 'progress-storage',
    label: 'Progress',
    creator: (set) => ({
        activeTab: 'activity',
        dateRange: '30days',
        setActiveTab: (tab: ProgressTab) => set({ activeTab: tab }),
        setDateRange: (range: DateRange) => set({ dateRange: range }),
    }),
    persistOptions: {
        partialize: (state) => ({
            activeTab: state.activeTab,
            dateRange: state.dateRange,
        }),
    },
});

/**
 * Derived hooks for convenience
 */
export const useProgressActiveTab = () => useProgressStore((state) => state.activeTab);
export const useProgressDateRange = () => useProgressStore((state) => state.dateRange);
export const useSetProgressActiveTab = () => useProgressStore((state) => state.setActiveTab);
export const useSetProgressDateRange = () => useProgressStore((state) => state.setDateRange);
