/**
 * Plan Data Hooks
 * 
 * Adapter hooks that wrap store actions to provide a mutation-like interface.
 * This allows gradual migration from React Query to Zustand.
 * 
 * With local-first, updates are synchronous so there's no "pending" state.
 * The sync to server happens in the background via debounced sync.
 */

import { useCallback, useEffect } from 'react';
import { usePlanDataStore } from './store';
import { loadPlan, syncPlanToServer, syncFromCloud, loadWeekProgress } from './sync';
import type { ExerciseUpdates, NewExercise, PlanExerciseWithDefinition, ExerciseProgress } from './types';

// ============================================================================
// Stable Fallback References (CRITICAL for Zustand selectors)
// ============================================================================
// These prevent infinite loops caused by creating new [] or {} on every render

const EMPTY_EXERCISES: PlanExerciseWithDefinition[] = [];
const EMPTY_PROGRESS: Record<string, ExerciseProgress> = {};

// ============================================================================
// Load Hook
// ============================================================================

/**
 * Hook to load plan data on mount.
 * 
 * - If localStorage has data: use it immediately
 * - If localStorage empty: fetch from server
 */
export function useLoadPlan(planId: string | null, weekNumber: number) {
    const loading = usePlanDataStore((s) => planId ? s.loading[planId] : false);
    const hasData = usePlanDataStore((s) => planId ? !!s.plans[planId] : false);

    useEffect(() => {
        if (planId && !hasData) {
            void loadPlan(planId, weekNumber);
        }
    }, [planId, weekNumber, hasData]);

    return { isLoading: loading && !hasData };
}

/**
 * Hook to load week progress when navigating to a new week
 */
export function useLoadWeekProgress(planId: string | null, weekNumber: number) {
    useEffect(() => {
        if (planId) {
            void loadWeekProgress(planId, weekNumber);
        }
    }, [planId, weekNumber]);
}

// ============================================================================
// Exercise Selectors
// ============================================================================

/**
 * Get exercises for a plan from the store
 */
export function usePlanExercisesFromStore(planId: string | null): PlanExerciseWithDefinition[] {
    return usePlanDataStore((s) => {
        if (!planId) return EMPTY_EXERCISES;
        return s.plans[planId]?.exercises ?? EMPTY_EXERCISES;
    });
}

/**
 * Get week progress for a plan from the store
 */
export function useWeekProgressFromStore(
    planId: string | null,
    weekNumber: number
): Record<string, ExerciseProgress> {
    return usePlanDataStore((s) => {
        if (!planId) return EMPTY_PROGRESS;
        return s.plans[planId]?.weekProgress?.[weekNumber] ?? EMPTY_PROGRESS;
    });
}

// ============================================================================
// Exercise Mutation Adapters
// ============================================================================

/**
 * Adapter hook for adding an exercise (mimics mutation interface)
 * 
 * @param planId - The plan to add to
 * @param exerciseLibrary - Optional exercise library to look up definitions
 */
export function useAddPlanExerciseAdapter(
    planId: string,
    exerciseLibrary?: Array<{ _id: string } & NewExercise['exerciseDef']>
) {
    const addExercise = usePlanDataStore((s) => s.addExercise);

    const mutate = useCallback(
        (
            params: { 
                planId: string;
                exerciseDefId: string; 
                sets: number; 
                reps: number; 
                weight?: number;
                durationSeconds?: number;
                comments?: string;
                exerciseDef?: NewExercise['exerciseDef'];
            },
            options?: { onSuccess?: () => void; onError?: (error: Error) => void }
        ) => {
            try {
                // Get exerciseDef from params or look up from library
                const exerciseDef = params.exerciseDef || 
                    exerciseLibrary?.find((e) => e._id === params.exerciseDefId);
                
                if (!exerciseDef) {
                    throw new Error('Exercise definition not found');
                }

                addExercise(planId, {
                    exerciseDefId: params.exerciseDefId,
                    exerciseDef,
                    sets: params.sets,
                    reps: params.reps,
                    weight: params.weight,
                    durationSeconds: params.durationSeconds,
                    comments: params.comments,
                });
                syncPlanToServer(planId);
                options?.onSuccess?.();
            } catch (error) {
                options?.onError?.(error instanceof Error ? error : new Error('Failed to add exercise'));
            }
        },
        [planId, addExercise, exerciseLibrary]
    );

    return { mutate, isPending: false };
}

/**
 * Adapter hook for bulk adding exercises (mimics mutation interface)
 * 
 * @param planId - The plan to add to
 * @param exerciseLibrary - Optional exercise library to look up definitions
 */
export function useBulkAddPlanExercisesAdapter(
    planId: string,
    exerciseLibrary?: Array<{ _id: string } & NewExercise['exerciseDef']>
) {
    const addExercise = usePlanDataStore((s) => s.addExercise);

    const mutate = useCallback(
        (
            params: { 
                planId: string;
                exercises: Array<{ 
                    exerciseDefId: string; 
                    sets: number; 
                    reps: number; 
                    weight?: number;
                    durationSeconds?: number;
                    comments?: string;
                    exerciseDef?: NewExercise['exerciseDef'];
                }>;
            },
            options?: { 
                onSuccess?: (response?: { addedCount?: number }) => void; 
                onError?: (error: Error) => void;
            }
        ) => {
            try {
                let addedCount = 0;
                params.exercises.forEach((ex) => {
                    // Get exerciseDef from params or look up from library
                    const exerciseDef = ex.exerciseDef || 
                        exerciseLibrary?.find((e) => e._id === ex.exerciseDefId);
                    
                    if (exerciseDef) {
                        addExercise(planId, {
                            exerciseDefId: ex.exerciseDefId,
                            exerciseDef,
                            sets: ex.sets,
                            reps: ex.reps,
                            weight: ex.weight,
                            durationSeconds: ex.durationSeconds,
                            comments: ex.comments,
                        });
                        addedCount++;
                    }
                });
                syncPlanToServer(planId);
                options?.onSuccess?.({ addedCount });
            } catch (error) {
                options?.onError?.(error instanceof Error ? error : new Error('Failed to add exercises'));
            }
        },
        [planId, addExercise, exerciseLibrary]
    );

    return { mutate, isPending: false };
}

/**
 * Adapter hook for updating an exercise (mimics mutation interface)
 */
export function useUpdatePlanExerciseAdapter(planId: string) {
    const updateExercise = usePlanDataStore((s) => s.updateExercise);

    const mutate = useCallback(
        (
            params: { 
                planExerciseId: string; 
                sets?: number; 
                reps?: number; 
                weight?: number;
                durationSeconds?: number;
                comments?: string;
            },
            options?: { onSuccess?: () => void; onError?: (error: Error) => void }
        ) => {
            try {
                const updates: ExerciseUpdates = {};
                if (params.sets !== undefined) updates.sets = params.sets;
                if (params.reps !== undefined) updates.reps = params.reps;
                if (params.weight !== undefined) updates.weight = params.weight;
                if (params.durationSeconds !== undefined) updates.durationSeconds = params.durationSeconds;
                if (params.comments !== undefined) updates.comments = params.comments;

                updateExercise(planId, params.planExerciseId, updates);
                syncPlanToServer(planId);
                options?.onSuccess?.();
            } catch (error) {
                options?.onError?.(error instanceof Error ? error : new Error('Failed to update exercise'));
            }
        },
        [planId, updateExercise]
    );

    return { mutate, isPending: false };
}

/**
 * Adapter hook for deleting an exercise (mimics mutation interface)
 */
export function useDeletePlanExerciseAdapter(planId: string) {
    const deleteExercise = usePlanDataStore((s) => s.deleteExercise);

    const mutate = useCallback(
        (
            params: { planExerciseId: string },
            options?: { onSuccess?: () => void; onError?: (error: Error) => void }
        ) => {
            try {
                deleteExercise(planId, params.planExerciseId);
                syncPlanToServer(planId);
                options?.onSuccess?.();
            } catch (error) {
                options?.onError?.(error instanceof Error ? error : new Error('Failed to delete exercise'));
            }
        },
        [planId, deleteExercise]
    );

    return { mutate, isPending: false };
}

/**
 * Adapter hook for reordering exercises (mimics mutation interface)
 */
export function useReorderPlanExercisesAdapter(planId: string) {
    const reorderExercises = usePlanDataStore((s) => s.reorderExercises);

    const mutate = useCallback(
        (params: { exerciseIds: string[] }) => {
            reorderExercises(planId, params.exerciseIds);
            syncPlanToServer(planId);
        },
        [planId, reorderExercises]
    );

    return { mutate, isPending: false };
}

// ============================================================================
// Week Progress Data Hook (for Home.tsx)
// ============================================================================

/**
 * Hook that provides week progress data in the format expected by Home.tsx
 * Combines exercises and week progress from the store
 */
export interface ExerciseWeekProgressFromStore {
    planExerciseId: string;
    targetSets: number;
    setsCompleted: number;
    isDone: boolean;
    exerciseDef: PlanExerciseWithDefinition['exerciseDef'];
    planExercise: {
        _id: string;
        planId: string;
        exerciseDefId: string;
        sets: number;
        reps: number;
        weight: number;
        durationSeconds: number;
        comments: string;
        order: number;
        createdAt: string;
        updatedAt: string;
    };
}

export interface WeekProgressDataFromStore {
    weekNumber: number;
    totalSets: number;
    completedSets: number;
    progressPercent: number;
    exercises: ExerciseWeekProgressFromStore[];
}

export function useWeekProgressFromStoreData(
    planId: string | null,
    weekNumber: number
): WeekProgressDataFromStore | null {
    const exercises = usePlanDataStore((s) => {
        if (!planId) return EMPTY_EXERCISES;
        return s.plans[planId]?.exercises ?? EMPTY_EXERCISES;
    });
    const weekProgress = usePlanDataStore((s) => {
        if (!planId) return EMPTY_PROGRESS;
        return s.plans[planId]?.weekProgress?.[weekNumber] ?? EMPTY_PROGRESS;
    });

    if (!planId || exercises.length === 0) {
        return null;
    }

    // Build the week progress data structure
    let totalSets = 0;
    let completedSets = 0;

    const exerciseProgress: ExerciseWeekProgressFromStore[] = exercises.map((ex) => {
        const progress = weekProgress[ex._id] || { setsCompleted: 0, isDone: false };
        const setsCompleted = progress.setsCompleted;
        const isDone = progress.isDone || setsCompleted >= ex.sets;

        totalSets += ex.sets;
        completedSets += Math.min(setsCompleted, ex.sets);

        return {
            planExerciseId: ex._id,
            targetSets: ex.sets,
            setsCompleted,
            isDone,
            exerciseDef: ex.exerciseDef,
            planExercise: {
                _id: ex._id,
                planId: ex.planId,
                exerciseDefId: ex.exerciseDefId,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight,
                durationSeconds: ex.durationSeconds,
                comments: ex.comments,
                order: ex.order,
                createdAt: ex.createdAt,
                updatedAt: ex.updatedAt,
            },
        };
    });

    const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

    return {
        weekNumber,
        totalSets,
        completedSets,
        progressPercent,
        exercises: exerciseProgress,
    };
}

// ============================================================================
// Progress Mutation Adapters
// ============================================================================

/**
 * Adapter hook for incrementing sets
 */
export function useIncrementSetAdapter() {
    const incrementSet = usePlanDataStore((s) => s.incrementSet);

    const mutate = useCallback(
        (params: { planId: string; weekNumber: number; exerciseId: string; targetSets: number }) => {
            incrementSet(params.planId, params.weekNumber, params.exerciseId, params.targetSets);
            syncPlanToServer(params.planId);
        },
        [incrementSet]
    );

    return { mutate, isPending: false };
}

/**
 * Adapter hook for decrementing sets
 */
export function useDecrementSetAdapter() {
    const decrementSet = usePlanDataStore((s) => s.decrementSet);

    const mutate = useCallback(
        (params: { planId: string; weekNumber: number; exerciseId: string }) => {
            decrementSet(params.planId, params.weekNumber, params.exerciseId);
            syncPlanToServer(params.planId);
        },
        [decrementSet]
    );

    return { mutate, isPending: false };
}

/**
 * Adapter hook for completing all sets
 */
export function useCompleteAllSetsAdapter() {
    const completeAllSets = usePlanDataStore((s) => s.completeAllSets);

    const mutate = useCallback(
        (params: { planId: string; weekNumber: number; exerciseId: string; targetSets: number }) => {
            completeAllSets(params.planId, params.weekNumber, params.exerciseId, params.targetSets);
            syncPlanToServer(params.planId);
        },
        [completeAllSets]
    );

    return { mutate, isPending: false };
}

// ============================================================================
// Sync Hooks
// ============================================================================

/**
 * Hook for manual sync from cloud
 */
export function useSyncFromCloud(planId: string | null, weekNumber: number) {
    const syncing = usePlanDataStore((s) => planId ? s.syncing[planId] : false);

    const sync = useCallback(async () => {
        if (!planId) return;
        await syncFromCloud(planId, weekNumber);
    }, [planId, weekNumber]);

    return { sync, isSyncing: syncing };
}

/**
 * Hook to get store clear function
 */
export function useClearAllPlanData() {
    return usePlanDataStore((s) => s.clearAllPlanData);
}
