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
    
    /** Increment sets completed for an exercise */
    incrementSet: (planId: string, weekNumber: number, exerciseId: string, targetSets: number) => void;
    /** Decrement sets completed for an exercise */
    decrementSet: (planId: string, weekNumber: number, exerciseId: string) => void;
    /** Complete all remaining sets for an exercise */
    completeAllSets: (planId: string, weekNumber: number, exerciseId: string, targetSets: number) => void;

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

        incrementSet: (planId, weekNumber, exerciseId, targetSets) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;

                const weekProgress = { ...plan.weekProgress };
                const currentWeek = weekProgress[weekNumber] || {};
                const current = currentWeek[exerciseId] || { setsCompleted: 0, isDone: false };
                
                const newSetsCompleted = Math.min(current.setsCompleted + 1, targetSets);
                const newProgress: ExerciseProgress = {
                    setsCompleted: newSetsCompleted,
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

        decrementSet: (planId, weekNumber, exerciseId) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;

                const weekProgress = { ...plan.weekProgress };
                const currentWeek = weekProgress[weekNumber] || {};
                const current = currentWeek[exerciseId] || { setsCompleted: 0, isDone: false };
                
                const newSetsCompleted = Math.max(current.setsCompleted - 1, 0);
                const newProgress: ExerciseProgress = {
                    setsCompleted: newSetsCompleted,
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

        completeAllSets: (planId, weekNumber, exerciseId, targetSets) => {
            set((state) => {
                const plan = state.plans[planId];
                if (!plan) return state;

                const weekProgress = { ...plan.weekProgress };
                const currentWeek = weekProgress[weekNumber] || {};
                
                weekProgress[weekNumber] = {
                    ...currentWeek,
                    [exerciseId]: {
                        setsCompleted: targetSets,
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
            set({ plans: {}, loading: {}, syncing: {} });
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
