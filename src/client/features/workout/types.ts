/**
 * Workout feature types
 */
export type WorkoutTab = 'exercises' | 'workouts' | 'active';

export interface WorkoutState {
    currentWeek: number;
    activePlanId: string | null;
    viewMode: 'grid' | 'list';
    activeTab: WorkoutTab;
    // Selection mode state
    selectedExerciseIds: string[];
    isSelectionMode: boolean;
    setWeek: (week: number) => void;
    setActivePlan: (id: string | null) => void;
    setViewMode: (mode: 'grid' | 'list') => void;
    setActiveTab: (tab: WorkoutTab) => void;
    // Selection mode actions
    toggleSelection: (exerciseId: string) => void;
    clearSelection: () => void;
    setSelectionMode: (enabled: boolean) => void;
}


