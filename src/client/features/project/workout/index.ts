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
    // Expanded workout exports
    useExpandedWorkoutId,
    useSetExpandedWorkoutId,
} from './store';

// Export query/mutation hooks
export {
    usePlans,
    useWeekProgress,
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
    useActiveWorkoutTab,
    useSetActiveWorkoutTab,
    useExercisesViewMode,
    useSetExercisesViewMode,
    useGeneratedWarmup,
    useSetGeneratedWarmup,
    useWarmupCost,
    useSetWarmupCost,
    useRestJustCompletedAt,
    useDismissRestCompletedBanner,
} from './session-store';

// Export rest timer hook
export { useRestTimer, formatTime, primeRestAudio } from './use-rest-timer';

// Export session types and utilities
export type { WorkoutSession, WorkoutSessionState, ActiveWorkoutTab, ExercisesViewMode } from './session-types';
export { DEFAULT_REST_TIMES, getRecommendedRestTime } from './session-types';

// Export types
export type { WorkoutState, WorkoutTab } from './types';

