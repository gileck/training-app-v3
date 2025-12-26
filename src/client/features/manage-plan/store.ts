import { createStore } from '@/client/stores';
import type { ManagePlanState, ManagePlanTab, FilterSource } from './types';

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

/**
 * Derived hooks for convenience
 */
export const useManagePlanActiveTab = () => useManagePlanStore((state) => state.activeTab);
export const useManagePlanFilterMuscle = () => useManagePlanStore((state) => state.filterMuscle);
export const useManagePlanFilterType = () => useManagePlanStore((state) => state.filterType);
export const useManagePlanFilterSource = () => useManagePlanStore((state) => state.filterSource);
export const useSetManagePlanActiveTab = () => useManagePlanStore((state) => state.setActiveTab);
export const useSetManagePlanFilterMuscle = () => useManagePlanStore((state) => state.setFilterMuscle);
export const useSetManagePlanFilterType = () => useManagePlanStore((state) => state.setFilterType);
export const useSetManagePlanFilterSource = () => useManagePlanStore((state) => state.setFilterSource);
