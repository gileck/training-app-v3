import { createStore } from '@/client/stores';

/**
 * Manage Plan page types
 */
export type ManagePlanTab = 'exercises' | 'workouts';

export type FilterSource = 'all' | 'system' | 'custom';

interface ManagePlanState {
    activeTab: ManagePlanTab;
    filterMuscle: string;
    filterType: string;
    filterSource: FilterSource;
    setActiveTab: (tab: ManagePlanTab) => void;
    setFilterMuscle: (muscle: string) => void;
    setFilterType: (type: string) => void;
    setFilterSource: (source: FilterSource) => void;
}

/**
 * Manage Plan store - persists active tab and exercise filters across sessions
 */
export const useManagePlanStore = createStore<ManagePlanState>({
    key: 'manage-plan-storage',
    label: 'Manage Plan',
    creator: (set) => ({
        activeTab: 'exercises',
        filterMuscle: 'all',
        filterType: 'all',
        filterSource: 'all',
        setActiveTab: (tab: ManagePlanTab) => set({ activeTab: tab }),
        setFilterMuscle: (muscle: string) => set({ filterMuscle: muscle }),
        setFilterType: (type: string) => set({ filterType: type }),
        setFilterSource: (source: FilterSource) => set({ filterSource: source }),
    }),
    persistOptions: {
        partialize: (state) => ({
            activeTab: state.activeTab,
            filterMuscle: state.filterMuscle,
            filterType: state.filterType,
            filterSource: state.filterSource,
        }),
    },
});
