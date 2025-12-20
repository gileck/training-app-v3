// Export store and derived hooks
export {
    useWorkoutStore,
    useCurrentWeek,
    useActivePlanId,
    useViewMode,
} from './store';

// Export query/mutation hooks
export {
    usePlans,
    useWeekProgress,
    useUpdateSets,
    useSyncActivePlan,
    plansQueryKey,
    weekProgressQueryKey,
} from './hooks';

// Export types
export type { WorkoutState } from './types';

