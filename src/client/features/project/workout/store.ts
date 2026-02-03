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
        // Selection mode state (not persisted)
        selectedExerciseIds: [],
        isSelectionMode: false,
        // Expanded workout state
        expandedWorkoutId: null,
        setWeek: (week) => set({ currentWeek: week }),
        setActivePlan: (id) => set({ activePlanId: id }),
        setViewMode: (mode) => set({ viewMode: mode }),
        setActiveTab: (tab) => set({ activeTab: tab }),
        // Selection mode actions
        toggleSelection: (exerciseId) =>
            set((state) => {
                const isSelected = state.selectedExerciseIds.includes(exerciseId);
                const newSelectedIds = isSelected
                    ? state.selectedExerciseIds.filter((id) => id !== exerciseId)
                    : [...state.selectedExerciseIds, exerciseId];
                return {
                    selectedExerciseIds: newSelectedIds,
                    isSelectionMode: newSelectedIds.length > 0,
                };
            }),
        clearSelection: () => set({ selectedExerciseIds: [], isSelectionMode: false }),
        setSelectionMode: (enabled) =>
            set((state) => ({
                isSelectionMode: enabled,
                selectedExerciseIds: enabled ? state.selectedExerciseIds : [],
            })),
        // Expanded workout action
        setExpandedWorkoutId: (id) => set({ expandedWorkoutId: id }),
    }),
    persistOptions: {
        partialize: (state) => ({
            currentWeek: state.currentWeek,
            activePlanId: state.activePlanId,
            viewMode: state.viewMode,
            activeTab: state.activeTab,
            expandedWorkoutId: state.expandedWorkoutId,
            // Don't persist selection - it's ephemeral
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
export const useSelectedExerciseIds = () => useWorkoutStore((state) => state.selectedExerciseIds);
export const useIsSelectionMode = () => useWorkoutStore((state) => state.isSelectionMode);
export const useToggleSelection = () => useWorkoutStore((state) => state.toggleSelection);
export const useClearSelection = () => useWorkoutStore((state) => state.clearSelection);
export const useSetSelectionMode = () => useWorkoutStore((state) => state.setSelectionMode);
export const useExpandedWorkoutId = () => useWorkoutStore((state) => state.expandedWorkoutId);
export const useSetExpandedWorkoutId = () => useWorkoutStore((state) => state.setExpandedWorkoutId);


