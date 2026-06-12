/**
 * Plan Data Hooks
 *
 * Adapter hooks that wrap store actions to provide a mutation-like interface.
 * This allows gradual migration from React Query to Zustand.
 *
 * With local-first, updates are synchronous so there's no "pending" state.
 * The sync to server happens in the background via debounced sync.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { usePlanDataStore } from './store';
import { loadPlan, syncPlanToServer, syncFromCloud, loadWeekProgress } from './sync';
import { addActivity, deleteActivity, getActivity } from '@/apis/project/activity-logs/client';
import { uploadOverrideImage } from '@/apis/project/plan-exercises/client';
import { updatePlanWorkout } from '@/apis/project/plan-workouts/client';
import { planWorkoutsQueryKey } from '@/client/features/project/plan-workouts';
import {
    mergeExerciseDef,
    stripEmptyOverrides,
} from '@/apis/project/plan-exercises/mergeExerciseDef';
import type { ExerciseDefinitionOverrides } from '@/apis/project/plan-exercises/types';
import { useEffectiveOffline } from '@/client/features/template/settings';
import { generateId } from '@/client/utils/id';
import type { ExerciseUpdates, NewExercise, PlanExerciseWithDefinition, ExerciseProgress } from './types';
import type { AddActivityRequest, GetActivityResponse } from '@/apis/project/activity-logs/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';
import type { ListPlanWorkoutsResponse, PlanWorkoutClient } from '@/apis/project/plan-workouts/types';

// ============================================================================
// Stable Fallback References (CRITICAL for Zustand selectors)
// ============================================================================
// These prevent infinite loops caused by creating new [] or {} on every render

const EMPTY_EXERCISES: PlanExerciseWithDefinition[] = [];
const EMPTY_PROGRESS: Record<string, ExerciseProgress> = {};

function syncWorkoutItemsForExerciseSetChange(
    queryClient: QueryClient,
    planId: string,
    planExerciseId: string,
    previousSets: number,
    nextSets: number
) {
    const queryKey = planWorkoutsQueryKey(planId);
    const current = queryClient.getQueryData<ListPlanWorkoutsResponse>(queryKey);
    const workouts = current?.workouts;
    if (!workouts?.length) return;

    const changedWorkouts: PlanWorkoutClient[] = [];
    const nextWorkouts = workouts.map((workout) => {
        let changed = false;
        const items = workout.items.map((item) => {
            if (item.planExerciseId !== planExerciseId || item.sets !== previousSets) {
                return item;
            }

            changed = true;
            return { ...item, sets: nextSets };
        });

        if (!changed) return workout;

        const updatedWorkout = {
            ...workout,
            items,
            updatedAt: new Date().toISOString(),
        };
        changedWorkouts.push(updatedWorkout);
        return updatedWorkout;
    });

    if (changedWorkouts.length === 0) return;

    queryClient.setQueryData<ListPlanWorkoutsResponse>(queryKey, {
        ...current,
        workouts: nextWorkouts,
    });

    for (const workout of changedWorkouts) {
        void updatePlanWorkout({
            planId,
            workoutId: workout._id,
            items: workout.items.map((item, index) => ({
                planExerciseId: item.planExerciseId,
                order: index,
                ...(item.sets !== undefined && { sets: item.sets }),
            })),
        }).then((response) => {
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
        }).catch((error) => {
            console.error('Failed to sync workout set allocation after exercise update:', error);
            void queryClient.invalidateQueries({ queryKey });
        });
    }
}

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
 * Get exercises for a plan from the store.
 *
 * Returns only plan-wide exercises (weekNumber == null). Week-scoped
 * exercises live on the Home week view and must not leak into the plan
 * template editor (ManagePlan). Filtering is memoized so the returned
 * array keeps a stable reference between renders (avoids render loops).
 */
export function usePlanExercisesFromStore(planId: string | null): PlanExerciseWithDefinition[] {
    const allExercises = usePlanDataStore((s) => {
        if (!planId) return EMPTY_EXERCISES;
        return s.plans[planId]?.exercises ?? EMPTY_EXERCISES;
    });
    return useMemo(
        () => allExercises.filter((ex) => ex.weekNumber == null),
        [allExercises]
    );
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
                /** When set, scope the exercise to this week only. */
                weekNumber?: number;
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
                    weekNumber: params.weekNumber,
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
                /** When set, scope every added exercise to this week only. */
                weekNumber?: number;
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
                            weekNumber: params.weekNumber,
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
    const queryClient = useQueryClient();
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
                const previousExercise = usePlanDataStore
                    .getState()
                    .plans[planId]?.exercises.find((ex) => ex._id === params.planExerciseId);

                const updates: ExerciseUpdates = {};
                if (params.sets !== undefined) updates.sets = params.sets;
                if (params.reps !== undefined) updates.reps = params.reps;
                if (params.weight !== undefined) updates.weight = params.weight;
                if (params.durationSeconds !== undefined) updates.durationSeconds = params.durationSeconds;
                if (params.comments !== undefined) updates.comments = params.comments;

                updateExercise(planId, params.planExerciseId, updates);

                if (
                    params.sets !== undefined &&
                    previousExercise &&
                    previousExercise.sets !== params.sets
                ) {
                    syncWorkoutItemsForExerciseSetChange(
                        queryClient,
                        planId,
                        params.planExerciseId,
                        previousExercise.sets,
                        params.sets
                    );
                }

                syncPlanToServer(planId);
                options?.onSuccess?.();
            } catch (error) {
                options?.onError?.(error instanceof Error ? error : new Error('Failed to update exercise'));
            }
        },
        [planId, queryClient, updateExercise]
    );

    return { mutate, isPending: false };
}

/**
 * Adapter hook for updating per-plan-exercise definition overrides.
 *
 * Flow on `mutate`:
 *   1. If a new imageBase64 is provided, upload it first via the dedicated
 *      plan-exercises/upload-override-image endpoint and receive a Vercel
 *      Blob URL. When offline this is refused so base64 never lands in the
 *      sync queue.
 *   2. Build a candidate overrides object from the form fields, honouring
 *      the `imageCleared` flag to distinguish "user removed image" from
 *      "user didn't touch image".
 *   3. Strip fields equal to the base so the stored object only carries
 *      real customizations.
 *   4. Compute the merged effective def and hand both `overrides` and
 *      `mergedDef` to the store in a single atomic update.
 *   5. Kick off the debounced sync to persist the whole plan.
 */
export function useUpdatePlanExerciseOverridesAdapter(planId: string) {
    const updateExerciseOverrides = usePlanDataStore((s) => s.updateExerciseOverrides);
    const isOffline = useEffectiveOffline();

    const mutate = useCallback(
        async (
            params: {
                planExerciseId: string;
                baseDef: ExerciseDefinitionClient;
                form: {
                    name: string;
                    imageBase64?: string;
                    imageCleared?: boolean;
                    primaryMuscle: string;
                    secondaryMuscles: string[];
                    type: string;
                    isBodyweight: boolean;
                    isStatic: boolean;
                };
                /** Current effective imageUrl from the merged def (used when image is unchanged). */
                currentImageUrl: string;
            },
            options?: {
                onSuccess?: () => void;
                onError?: (error: Error) => void;
            }
        ) => {
            try {
                // 1. Resolve the override imageUrl.
                //
                // - New base64 upload: upload now and use the returned Blob URL.
                // - Image cleared: explicit empty string override.
                // - Otherwise: keep whatever is currently effective; we pass
                //   `currentImageUrl` as the candidate so stripEmptyOverrides
                //   naturally removes the key when it matches the base.
                let resolvedImageUrl = params.currentImageUrl;
                if (params.form.imageBase64) {
                    if (isOffline) {
                        throw new Error('Image upload is not available while offline.');
                    }
                    const response = await uploadOverrideImage({
                        imageBase64: params.form.imageBase64,
                    });
                    if (response.data?.error || !response.data?.imageUrl) {
                        throw new Error(response.data?.error || 'Image upload failed');
                    }
                    resolvedImageUrl = response.data.imageUrl;
                } else if (params.form.imageCleared) {
                    resolvedImageUrl = '';
                }

                // 2. Build the candidate overrides from the full form state.
                const candidate: ExerciseDefinitionOverrides = {
                    name: params.form.name,
                    imageUrl: resolvedImageUrl,
                    primaryMuscle: params.form.primaryMuscle,
                    secondaryMuscles: params.form.secondaryMuscles,
                    type: params.form.type,
                    isBodyweight: params.form.isBodyweight,
                    isStatic: params.form.isStatic,
                };

                // 3. Strip fields that equal the base.
                const stripped = stripEmptyOverrides(candidate, params.baseDef);

                // 4. Compute the merged def and apply atomically.
                const mergedDef = mergeExerciseDef(params.baseDef, stripped);
                updateExerciseOverrides(planId, params.planExerciseId, {
                    overrides: stripped,
                    mergedDef,
                });

                // 5. Schedule sync.
                syncPlanToServer(planId);
                options?.onSuccess?.();
            } catch (error) {
                options?.onError?.(
                    error instanceof Error ? error : new Error('Failed to update exercise overrides')
                );
            }
        },
        [planId, updateExerciseOverrides, isOffline]
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
    isSkipped: boolean;
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
        /** Optional week scoping. Undefined = plan-wide; N = week N only. */
        weekNumber?: number;
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
    const allExercises = usePlanDataStore((s) => {
        if (!planId) return EMPTY_EXERCISES;
        return s.plans[planId]?.exercises ?? EMPTY_EXERCISES;
    });
    const weekProgress = usePlanDataStore((s) => {
        if (!planId) return EMPTY_PROGRESS;
        return s.plans[planId]?.weekProgress?.[weekNumber] ?? EMPTY_PROGRESS;
    });

    // Show plan-wide exercises (no weekNumber) plus exercises scoped to this
    // exact week. This is the single client-side gate that keeps a
    // week-scoped exercise visible only in its own week.
    const exercises = allExercises.filter(
        (ex) => ex.weekNumber == null || ex.weekNumber === weekNumber
    );

    if (!planId || exercises.length === 0) {
        return null;
    }

    // Build the week progress data structure
    let totalSets = 0;
    let completedSets = 0;

    const exerciseProgress: ExerciseWeekProgressFromStore[] = exercises.map((ex) => {
        const progress = weekProgress[ex._id] || { setsCompleted: 0, isDone: false };
        const setsCompleted = progress.setsCompleted;
        const isSkipped = progress.isSkipped === true;
        const isDone = progress.isDone || setsCompleted >= ex.sets;

        if (!isSkipped) {
            totalSets += ex.sets;
            completedSets += Math.min(setsCompleted, ex.sets);
        }

        return {
            planExerciseId: ex._id,
            targetSets: ex.sets,
            setsCompleted,
            isDone,
            isSkipped,
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
                weekNumber: ex.weekNumber,
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

// ============================================================================
// Set Progress Hook (unified add/remove/complete-all with activity logging)
// ============================================================================

/**
 * Hook for managing exercise set progress with activity logging.
 *
 * Combines:
 * - Store update (incrementSet/decrementSet/completeAllSets)
 * - Server sync (syncPlanToServer)
 * - Activity logging (addActivity/deleteActivity)
 *
 * This is the unified way to update set progress across the app.
 *
 * @param planId - The plan ID
 * @param weekNumber - The week number
 * @param workoutId - Optional workout ID for workout-specific tracking
 *
 * @example
 * ```typescript
 * // For exercise tab (no workout tracking)
 * const { addSet, removeSet, completeAllSets } = useSetProgress(planId, weekNumber);
 *
 * // For workout tab (with workout tracking)
 * const { addSet, removeSet } = useSetProgress(planId, weekNumber, workoutId);
 *
 * // Add a single set
 * addSet(exerciseId, targetSets);
 *
 * // Remove a set
 * removeSet(exerciseId);
 *
 * // Complete all remaining sets
 * completeAllSets(exerciseId, targetSets, currentSetsCompleted);
 * ```
 */
export function useSetProgress(planId: string | null, weekNumber: number, workoutId?: string | null) {
    const queryClient = useQueryClient();
    const incrementSet = usePlanDataStore((s) => s.incrementSet);
    const decrementSet = usePlanDataStore((s) => s.decrementSet);
    const completeAllSetsAction = usePlanDataStore((s) => s.completeAllSets);
    const incrementSetForWorkout = usePlanDataStore((s) => s.incrementSetForWorkout);
    const decrementSetForWorkout = usePlanDataStore((s) => s.decrementSetForWorkout);

    // Activity mutations (internal)
    const addActivityMutation = useMutation({
        mutationFn: async (data: AddActivityRequest & { activityIds: string[] }) => {
            const response = await addActivity({
                ...data,
                activityIds: data.activityIds,
            });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });

    const deleteRecentActivityMutation = useMutation({
        mutationFn: async (data: { planExerciseId: string; date: string }) => {
            const response = await getActivity({
                startDate: data.date,
                endDate: data.date,
                limit: 100,
            });

            if (response.data?.error) {
                return { success: false };
            }

            const activities = response.data?.activities || [];
            const recentActivity = activities.find(
                (a) => a.planExerciseId === data.planExerciseId
            );

            if (!recentActivity) {
                return { success: false };
            }

            const deleteResponse = await deleteActivity({
                activityId: recentActivity._id,
            });

            if (deleteResponse.data?.error) {
                return { success: false };
            }

            return { success: true };
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: ['activity'] });

            queryClient.setQueriesData<GetActivityResponse>(
                { queryKey: ['activity'] },
                (old) => {
                    if (!old?.activities) return old;
                    const activities = [...old.activities];
                    const index = activities.findIndex(
                        (a) => a.planExerciseId === variables.planExerciseId
                    );
                    if (index !== -1) {
                        activities.splice(index, 1);
                    }
                    return { ...old, activities };
                }
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        },
    });

    /**
     * Add a single set to an exercise
     * @param exerciseId - The exercise ID
     * @param targetSets - The target number of sets
     * @param overrideWorkoutId - Optional override for workout ID (used by workout picker)
     * @param onSuccess - Optional callback called with activity IDs after logging
     */
    const addSet = useCallback(
        (exerciseId: string, targetSets: number, overrideWorkoutId?: string, onSuccess?: (activityIds: string[]) => void) => {
            if (!planId) return;

            const effectiveWorkoutId = overrideWorkoutId ?? workoutId;

            // Update store (workout-specific or general)
            if (effectiveWorkoutId) {
                incrementSetForWorkout(planId, weekNumber, exerciseId, effectiveWorkoutId, targetSets);
            } else {
                incrementSet(planId, weekNumber, exerciseId, targetSets);
            }
            syncPlanToServer(planId);

            // Create activity log
            const activityIds = [generateId()];
            addActivityMutation.mutate({
                planExerciseId: exerciseId,
                completedAt: new Date().toISOString(),
                numberOfSets: 1,
                activityIds,
                weekNumber, // Pass the current week number
            });

            // Call onSuccess callback with activity IDs
            if (onSuccess) {
                onSuccess(activityIds);
            }
        },
        [planId, weekNumber, workoutId, incrementSet, incrementSetForWorkout, addActivityMutation]
    );

    /**
     * Remove a set from an exercise
     * @param exerciseId - The exercise ID
     * @param overrideWorkoutId - Optional override for workout ID
     */
    const removeSet = useCallback(
        (exerciseId: string, overrideWorkoutId?: string) => {
            if (!planId) return;

            const effectiveWorkoutId = overrideWorkoutId ?? workoutId;

            // Update store (workout-specific or general)
            if (effectiveWorkoutId) {
                decrementSetForWorkout(planId, weekNumber, exerciseId, effectiveWorkoutId);
            } else {
                decrementSet(planId, weekNumber, exerciseId);
            }
            syncPlanToServer(planId);

            // Delete activity log
            deleteRecentActivityMutation.mutate({
                planExerciseId: exerciseId,
                date: new Date().toISOString().split('T')[0],
            });
        },
        [planId, weekNumber, workoutId, decrementSet, decrementSetForWorkout, deleteRecentActivityMutation]
    );

    /**
     * Complete all remaining sets for an exercise
     */
    const completeAllSets = useCallback(
        (exerciseId: string, targetSets: number, currentSetsCompleted: number) => {
            if (!planId) return;

            const remaining = targetSets - currentSetsCompleted;
            if (remaining <= 0) return;

            // Update store
            completeAllSetsAction(planId, weekNumber, exerciseId, targetSets);
            syncPlanToServer(planId);

            // Create activity logs for remaining sets
            const activityIds = Array.from({ length: remaining }, () => generateId());
            addActivityMutation.mutate({
                planExerciseId: exerciseId,
                completedAt: new Date().toISOString(),
                numberOfSets: remaining,
                activityIds,
                weekNumber, // Pass the current week number
            });
        },
        [planId, weekNumber, completeAllSetsAction, addActivityMutation]
    );

    return { addSet, removeSet, completeAllSets };
}
