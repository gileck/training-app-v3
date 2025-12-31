// Export store and derived hooks
export {
    useWorkoutStore,
    useCurrentWeek,
    useActivePlanId,
    useViewMode,
    useActiveTab,
    // Selection mode exports
    useSelectedExerciseIds,
    useIsSelectionMode,
    useToggleSelection,
    useClearSelection,
    useSetSelectionMode,
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

// Export session store (active workout)
export {
    useWorkoutSessionStore,
    useIsSessionActive,
    useSessionExercises,
    useCurrentExerciseIndex,
    useCurrentExercise,
    useRestTimerEndAt,
    useRestTimerDuration,
    useCompletedSetsThisSession,
    useSessionStartedAt,
    usePlanWorkoutId,
    usePlanWorkoutName,
    useStartSession,
    useEndSession,
    useSetCurrentExercise,
    useStartRestTimer,
    useCancelRestTimer,
    useIncrementCompletedSets,
    useUpdateSessionExercises,
    useToggleAutoStartTimer,
    useAutoStartTimer,
    useSetPlanWorkoutId,
    useSetPlanWorkoutName,
    useIsInSet,
    useSetIsInSet,
    useSetRestTimerDuration,
    useSupersetEnabled,
    useSupersetExerciseIds,
    useSetSupersetEnabled,
    useSetSupersetExerciseIds,
} from './session-store';

// Export rest timer hook
export { useRestTimer, formatTime } from './use-rest-timer';

// Export session types and utilities
export type { WorkoutSession, WorkoutSessionState } from './session-types';
export { DEFAULT_REST_TIMES, getRecommendedRestTime } from './session-types';

// Export types
export type { WorkoutState, WorkoutTab } from './types';

