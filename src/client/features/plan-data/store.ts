/**
 * Plan Data Store
 * 
 * Local-first state management for plan exercises and weekly progress.
 * Data is persisted to localStorage and synced to server on changes.
 * 
 * @see docs/local-first-plan-data.md for architecture details
 */

import { createStore } from '@/client/stores';
import { generateId } from '@/client/utils/id';
import type { 
    PlanData, 
    PlanExerciseWithDefinition, 
    ExerciseUpdates, 
    NewExercise,
    ExerciseProgress,
    PlanConflict,
} from './types';

// ============================================================================
// State Interface
// ============================================================================

interface PlanDataState {
    /** Plan data indexed by planId */
    plans: Record<string, PlanData>;
    /** Loading state per plan (true when fetching from server) */
    loading: Record<string, boolean>;
    /** Syncing state per plan (true when syncing to/from cloud) */
    syncing: Record<string, boolean>;
    /** Conflict state per plan (when server has newer changes) */
    conflicts: Record<string, PlanConflict>;

    // ========================================================================
    // Internal setters (used by sync module)
    // ========================================================================
    
    /** Set plan data directly (used by sync module) */
    _setPlanData: (planId: string, data: PlanData) => void;
    /** Set loading state */
    _setLoading: (planId: string, isLoading: boolean) => void;
    /** Set syncing state */
    _setSyncing: (planId: string, isSyncing: boolean) => void;
    /** Mark plan as dirty (has unsaved changes) */
    _markDirty: (planId: string) => void;
    /** Mark plan as synced */
    _markSynced: (planId: string) => void;
    /** Clear plan data (for sync from cloud) */
    _clearPlan: (planId: string) => void;
    /** Set conflict state */
    _setConflict: (planId: string, serverLastSyncedAt: number) => void;
    /** Clear conflict state */
    _clearConflict: (planId: string) => void;

    // ========================================================================
    // Exercise Actions (used by ManagePlan)
    // ========================================================================
    
    /** Update an exercise's properties */
    updateExercise: (planId: string, exerciseId: string, updates: ExerciseUpdates) => void;
    /** Add a new exercise to the plan */
    addExercise: (planId: string, exercise: NewExercise) => void;
    /** Delete an exercise from the plan */
    deleteExercise: (planId: string, exerciseId: string) => void;
    /** Reorder exercises in the plan */
    reorderExercises: (planId: string, orderedIds: string[]) => void;

    // ========================================================================
    // Progress Actions (used by Home)
    // ========================================================================

    /** Increment sets completed for an exercise (workoutId optional for workout-attributed sets) */
    incrementSet: (planId: string, weekNumber: number, exerciseId: string, targetSets: number, workoutId?: string | null) => void;
    /** Decrement sets completed for an exercise (workoutId optional for workout-attributed sets) */
    decrementSet: (planId: string, weekNumber: number, exerciseId: string, workoutId?: string | null) => void;
    /** Complete all remaining sets for an exercise (workoutId optional for workout-attributed sets) */
    completeAllSets: (planId: string, weekNumber: number, exerciseId: string, targetSets: number, workoutId?: string | null) => void;

    // ========================================================================
    // Cache Management
    // ========================================================================
    
    /** Clear all plan data from cache */
    clearAllPlanData: () => void;
}

// ============================================================================
// Default Plan Data
// ============================================================================

const createEmptyPlanData = (): PlanData => ({
    exercises: [],
    weekProgress: {},
    lastSyncedAt: null,
    isDirty: false,
});

// ============================================================================
// Store
// ============================================================================

export const usePlanDataStore = createStore<PlanDataState>({
    key: 'plan-data-storage',
    label: 'Plan Data',
    creator: (set, _get) => ({
        plans: {},
        loading: {},
        syncing: {},
        conflicts: {},

        // ====================================================================
        // Internal setters
        // ====================================================================

        _setPlanData: (planId, data) => {
            set((state) => ({
                plans: { ...state.plans, [planId]: data },
            }));
        },

        _setLoading: (planId, isLoading) => {
            set((state) => ({
                loading: { ...state.loading, [planId]: isLoading },
            }));
        },

        _setSyncing: (planId, isSyncing) => {
            set((state) => ({
                syncing: { ...state.syncing, [planId]: isSyncing },
            }));
        },

        _markDirty: (planId) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;
                return {
                    plans: {
                        ...state.plans,
                        [planId]: { ...plan, isDirty: true },
                    },
                };
            });
        },

        _markSynced: (planId) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;
                return {
                    plans: {
                        ...state.plans,
                        [planId]: { 
                            ...plan, 
                            isDirty: false, 
                            lastSyncedAt: Date.now(),
                        },
                    },
                };
            });
        },

        _clearPlan: (planId) => {
            set((state) => {
                const { [planId]: _, ...rest } = state.plans;
                return { plans: rest };
            });
        },

        _setConflict: (planId, serverLastSyncedAt) => {
            set((state) => ({
                conflicts: {
                    ...state.conflicts,
                    [planId]: {
                        serverLastSyncedAt,
                        detectedAt: Date.now(),
                    },
                },
            }));
        },

        _clearConflict: (planId) => {
            set((state) => {
                const { [planId]: _, ...rest } = state.conflicts;
                return { conflicts: rest };
            });
        },

        // ====================================================================
        // Exercise Actions
        // ====================================================================

        updateExercise: (planId, exerciseId, updates) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;

                const exercises = plan.exercises.map((ex) =>
                    ex._id === exerciseId
                        ? {
                            ...ex,
                            ...updates,
                            updatedAt: new Date().toISOString(),
                        }
                        : ex
                );

                return {
                    plans: {
                        ...state.plans,
                        [planId]: { ...plan, exercises, isDirty: true },
                    },
                };
            });
        },

        addExercise: (planId, exercise) => {
            set((state) => {
                const plan = state.plans[planId] || createEmptyPlanData();
                const now = new Date().toISOString();
                const newExercise: PlanExerciseWithDefinition = {
                    _id: exercise._id || generateId(),
                    planId,
                    exerciseDefId: exercise.exerciseDefId,
                    sets: exercise.sets,
                    reps: exercise.reps,
                    weight: exercise.weight || 0,
                    durationSeconds: exercise.durationSeconds || 0,
                    comments: exercise.comments || '',
                    order: plan.exercises.length,
                    createdAt: now,
                    updatedAt: now,
                    exerciseDef: exercise.exerciseDef,
                };

                return {
                    plans: {
                        ...state.plans,
                        [planId]: {
                            ...plan,
                            exercises: [...plan.exercises, newExercise],
                            isDirty: true,
                        },
                    },
                };
            });
        },

        deleteExercise: (planId, exerciseId) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;

                const exercises = plan.exercises
                    .filter((ex) => ex._id !== exerciseId)
                    .map((ex, index) => ({ ...ex, order: index }));

                // Also remove from weekProgress
                const weekProgress = { ...plan.weekProgress };
                for (const week of Object.keys(weekProgress)) {
                    const weekNum = parseInt(week, 10);
                    const { [exerciseId]: _, ...rest } = weekProgress[weekNum] || {};
                    weekProgress[weekNum] = rest;
                }

                return {
                    plans: {
                        ...state.plans,
                        [planId]: { ...plan, exercises, weekProgress, isDirty: true },
                    },
                };
            });
        },

        reorderExercises: (planId, orderedIds) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;

                const exerciseMap = new Map(plan.exercises.map((ex) => [ex._id, ex]));
                const exercises = orderedIds
                    .map((id, index) => {
                        const ex = exerciseMap.get(id);
                        return ex ? { ...ex, order: index, updatedAt: new Date().toISOString() } : null;
                    })
                    .filter((ex): ex is PlanExerciseWithDefinition => ex !== null);

                return {
                    plans: {
                        ...state.plans,
                        [planId]: { ...plan, exercises, isDirty: true },
                    },
                };
            });
        },

        // ====================================================================
        // Progress Actions
        // ====================================================================

        incrementSet: (planId, weekNumber, exerciseId, targetSets, workoutId = null) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;

                const weekProgress = { ...plan.weekProgress };
                const currentWeek = weekProgress[weekNumber] || {};
                const current = currentWeek[exerciseId] || { setsCompleted: 0, workoutSets: [], isDone: false };

                const newSetsCompleted = Math.min(current.setsCompleted + 1, targetSets);

                // Update workout-specific tracking if workoutId provided
                const newWorkoutSets = [...(current.workoutSets || [])];
                if (workoutId) {
                    const existingIdx = newWorkoutSets.findIndex(w => w.workoutId === workoutId);
                    if (existingIdx >= 0) {
                        newWorkoutSets[existingIdx] = {
                            ...newWorkoutSets[existingIdx],
                            setsCompleted: newWorkoutSets[existingIdx].setsCompleted + 1,
                        };
                    } else {
                        newWorkoutSets.push({ workoutId, setsCompleted: 1 });
                    }
                }

                const newProgress: ExerciseProgress = {
                    setsCompleted: newSetsCompleted,
                    workoutSets: newWorkoutSets,
                    isDone: newSetsCompleted >= targetSets,
                };

                weekProgress[weekNumber] = {
                    ...currentWeek,
                    [exerciseId]: newProgress,
                };

                return {
                    plans: {
                        ...state.plans,
                        [planId]: { ...plan, weekProgress, isDirty: true },
                    },
                };
            });
        },

        decrementSet: (planId, weekNumber, exerciseId, workoutId = null) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;

                const weekProgress = { ...plan.weekProgress };
                const currentWeek = weekProgress[weekNumber] || {};
                const current = currentWeek[exerciseId] || { setsCompleted: 0, workoutSets: [], isDone: false };

                const newSetsCompleted = Math.max(current.setsCompleted - 1, 0);

                // Update workout-specific tracking if workoutId provided
                const newWorkoutSets = [...(current.workoutSets || [])];
                if (workoutId) {
                    const existingIdx = newWorkoutSets.findIndex(w => w.workoutId === workoutId);
                    if (existingIdx >= 0 && newWorkoutSets[existingIdx].setsCompleted > 0) {
                        newWorkoutSets[existingIdx] = {
                            ...newWorkoutSets[existingIdx],
                            setsCompleted: newWorkoutSets[existingIdx].setsCompleted - 1,
                        };
                    }
                }

                const newProgress: ExerciseProgress = {
                    setsCompleted: newSetsCompleted,
                    workoutSets: newWorkoutSets,
                    isDone: false, // Can't be done if we just removed a set
                };

                weekProgress[weekNumber] = {
                    ...currentWeek,
                    [exerciseId]: newProgress,
                };

                return {
                    plans: {
                        ...state.plans,
                        [planId]: { ...plan, weekProgress, isDirty: true },
                    },
                };
            });
        },

        completeAllSets: (planId, weekNumber, exerciseId, targetSets, workoutId = null) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;

                const weekProgress = { ...plan.weekProgress };
                const currentWeek = weekProgress[weekNumber] || {};
                const current = currentWeek[exerciseId] || { setsCompleted: 0, workoutSets: [], isDone: false };

                // Update workout-specific tracking if workoutId provided
                const newWorkoutSets = [...(current.workoutSets || [])];
                if (workoutId) {
                    const existingIdx = newWorkoutSets.findIndex(w => w.workoutId === workoutId);
                    if (existingIdx >= 0) {
                        newWorkoutSets[existingIdx] = {
                            ...newWorkoutSets[existingIdx],
                            setsCompleted: targetSets,
                        };
                    } else {
                        newWorkoutSets.push({ workoutId, setsCompleted: targetSets });
                    }
                }

                weekProgress[weekNumber] = {
                    ...currentWeek,
                    [exerciseId]: {
                        setsCompleted: targetSets,
                        workoutSets: newWorkoutSets,
                        isDone: true,
                    },
                };

                return {
                    plans: {
                        ...state.plans,
                        [planId]: { ...plan, weekProgress, isDirty: true },
                    },
                };
            });
        },

        // ====================================================================
        // Cache Management
        // ====================================================================

        clearAllPlanData: () => {
            set({ plans: {}, loading: {}, syncing: {}, conflicts: {} });
        },
    }),
    persistOptions: {
        partialize: (state) => ({
            plans: state.plans,
        }),
        merge: (persistedState, currentState) => {
            const persisted = persistedState as { plans?: Record<string, PlanData> };
            return {
                ...currentState,
                plans: persisted?.plans || {},
            };
        },
    },
});

// ============================================================================
// Selectors
// ============================================================================

// Stable fallback references (prevent infinite loops - see docs/zustand-stores.md)
const EMPTY_EXERCISES: PlanExerciseWithDefinition[] = [];
const EMPTY_PROGRESS: Record<string, ExerciseProgress> = {};

/**
 * Get exercises for a plan
 */
export function usePlanExercises(planId: string | null): PlanExerciseWithDefinition[] {
    return usePlanDataStore((state) => {
        if (!planId) return EMPTY_EXERCISES;
        return state.plans[planId]?.exercises ?? EMPTY_EXERCISES;
    });
}

/**
 * Get week progress for a plan
 */
export function useWeekProgressData(
    planId: string | null, 
    weekNumber: number
): Record<string, ExerciseProgress> {
    return usePlanDataStore((state) => {
        if (!planId) return EMPTY_PROGRESS;
        return state.plans[planId]?.weekProgress?.[weekNumber] ?? EMPTY_PROGRESS;
    });
}

/**
 * Check if plan data is loading
 */
export function usePlanLoading(planId: string | null): boolean {
    return usePlanDataStore((state) => 
        planId ? state.loading[planId] ?? false : false
    );
}

/**
 * Check if plan is syncing
 */
export function usePlanSyncing(planId: string | null): boolean {
    return usePlanDataStore((state) => 
        planId ? state.syncing[planId] ?? false : false
    );
}

/**
 * Check if plan has data loaded
 */
export function usePlanHasData(planId: string | null): boolean {
    return usePlanDataStore((state) => 
        planId ? !!state.plans[planId] : false
    );
}

/**
 * Check if plan has unsaved changes
 */
export function usePlanIsDirty(planId: string | null): boolean {
    return usePlanDataStore((state) => 
        planId ? state.plans[planId]?.isDirty ?? false : false
    );
}

/**
 * Get conflict state for a plan (null if no conflict)
 */
export function usePlanConflict(planId: string | null): PlanConflict | null {
    return usePlanDataStore((state) => 
        planId ? state.conflicts[planId] ?? null : null
    );
}

/**
 * Check if plan has a sync conflict
 */
export function usePlanHasConflict(planId: string | null): boolean {
    return usePlanDataStore((state) => 
        planId ? !!state.conflicts[planId] : false
    );
}
