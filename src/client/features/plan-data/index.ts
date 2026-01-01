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
} from './store';

// Sync functions
export {
    loadPlan,
    syncPlanToServer,
    syncFromCloud,
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
} from './types';
