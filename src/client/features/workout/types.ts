/**
 * Workout feature types
 */
export interface WorkoutState {
    currentWeek: number;
    activePlanId: string | null;
    viewMode: 'grid' | 'list';
    setWeek: (week: number) => void;
    setActivePlan: (id: string | null) => void;
    setViewMode: (mode: 'grid' | 'list') => void;
}

