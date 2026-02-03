/**
 * Plan Data Feature
 * 
 * Local-first state management for plan exercises and weekly progress.
 * 
 * @example
 * ```typescript
 * import { 
 *     usePlanDataStore,
 *     usePlanExercises,
 *     useWeekProgressData,
 *     loadPlan,
 *     syncPlanToServer,
 *     syncFromCloud,
 * } from '@/client/features/plan-data';
 * ```
 */

// Store and selectors
export {
    usePlanDataStore,
    usePlanExercises,
    useWeekProgressData,
    usePlanLoading,
    usePlanSyncing,
    usePlanHasData,
    usePlanIsDirty,
    usePlanConflict,
    usePlanHasConflict,
    useWorkoutSetsForExercise,
    useWeekWorkoutSets,
} from './store';

// Sync functions
export {
    loadPlan,
    syncPlanToServer,
    syncFromCloud,
    forceSyncToServer,
    loadWeekProgress,
    initPlanDataSync,
} from './sync';

// Hooks (adapters for gradual migration)
export {
    useLoadPlan,
    useLoadWeekProgress,
    usePlanExercisesFromStore,
    useWeekProgressFromStore,
    useWeekProgressFromStoreData,
    useAddPlanExerciseAdapter,
    useBulkAddPlanExercisesAdapter,
    useUpdatePlanExerciseAdapter,
    useDeletePlanExerciseAdapter,
    useReorderPlanExercisesAdapter,
    useIncrementSetAdapter,
    useDecrementSetAdapter,
    useCompleteAllSetsAdapter,
    useSyncFromCloud,
    useClearAllPlanData,
    useSetProgress,
} from './hooks';

// Types for hooks
export type {
    ExerciseWeekProgressFromStore,
    WeekProgressDataFromStore,
} from './hooks';

// Types
export type {
    PlanData,
    PlanExerciseWithDefinition,
    ExerciseProgress,
    ExerciseUpdates,
    NewExercise,
    PlanConflict,
} from './types';
