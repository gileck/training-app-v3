import { createStore } from '@/client/stores';

/**
 * Progress page types
 */
export type DateRange = '7days' | '14days' | '30days' | '90days' | 'all';

export type ProgressTab = 'activity' | 'charts' | 'summary';

interface ProgressState {
    activeTab: ProgressTab;
    dateRange: DateRange;
    setActiveTab: (tab: ProgressTab) => void;
    setDateRange: (range: DateRange) => void;
}

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
