/**
 * Workout feature types
 */
export type WorkoutTab = 'exercises' | 'workouts' | 'active';

export interface WorkoutState {
    currentWeek: number;
    activePlanId: string | null;
    viewMode: 'grid' | 'list';
    activeTab: WorkoutTab;
    setWeek: (week: number) => void;
    setActivePlan: (id: string | null) => void;
    setViewMode: (mode: 'grid' | 'list') => void;
    setActiveTab: (tab: WorkoutTab) => void;
}


