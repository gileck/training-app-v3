import { createStore } from '@/client/stores';
import { WorkoutState } from './types';

/**
 * Workout store - persists current week, active plan, and UI state across sessions
 */
export const useWorkoutStore = createStore<WorkoutState>({
    key: 'workout-storage',
    label: 'Workout',
    creator: (set) => ({
        currentWeek: 1,
        activePlanId: null,
        viewMode: 'grid',
        activeTab: 'exercises',
        setWeek: (week) => set({ currentWeek: week }),
        setActivePlan: (id) => set({ activePlanId: id }),
        setViewMode: (mode) => set({ viewMode: mode }),
        setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    persistOptions: {
        partialize: (state) => ({
            currentWeek: state.currentWeek,
            activePlanId: state.activePlanId,
            viewMode: state.viewMode,
            activeTab: state.activeTab,
        }),
    },
});

/**
 * Derived hooks for convenience
 */
export const useCurrentWeek = () => useWorkoutStore((state) => state.currentWeek);
export const useActivePlanId = () => useWorkoutStore((state) => state.activePlanId);
export const useViewMode = () => useWorkoutStore((state) => state.viewMode);
export const useActiveTab = () => useWorkoutStore((state) => state.activeTab);


