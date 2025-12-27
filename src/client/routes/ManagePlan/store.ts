import { createStore } from '@/client/stores';

/**
 * Manage Plan page types
 */
export type ManagePlanTab = 'exercises' | 'workouts';

export type FilterSource = 'all' | 'system' | 'custom';

export type ExerciseViewMode = 'list' | 'grid';

interface ManagePlanState {
    activeTab: ManagePlanTab;
    filterMuscle: string;
    filterType: string;
    filterSource: FilterSource;
    exerciseViewMode: ExerciseViewMode;
    setActiveTab: (tab: ManagePlanTab) => void;
    setFilterMuscle: (muscle: string) => void;
    setFilterType: (type: string) => void;
    setFilterSource: (source: FilterSource) => void;
    setExerciseViewMode: (mode: ExerciseViewMode) => void;
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
        exerciseViewMode: 'grid',
        setActiveTab: (tab: ManagePlanTab) => set({ activeTab: tab }),
        setFilterMuscle: (muscle: string) => set({ filterMuscle: muscle }),
        setFilterType: (type: string) => set({ filterType: type }),
        setFilterSource: (source: FilterSource) => set({ filterSource: source }),
        setExerciseViewMode: (mode: ExerciseViewMode) => set({ exerciseViewMode: mode }),
    }),
    persistOptions: {
        partialize: (state) => ({
            activeTab: state.activeTab,
            filterMuscle: state.filterMuscle,
            filterType: state.filterType,
            filterSource: state.filterSource,
            exerciseViewMode: state.exerciseViewMode,
        }),
    },
});
