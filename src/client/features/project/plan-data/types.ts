/**
 * Plan Data Feature Types
 * 
 * Types for local-first plan data management.
 */

import type { PlanExerciseClient } from '@/server/database/collections/project/planExercises/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/project/exerciseDefinitions/types';
import type { ExerciseDefinitionOverrides } from '@/apis/project/plan-exercises/types';

/**
 * Exercise with its definition, used for display.
 *
 * `exerciseDef` is the MERGED effective definition (base merged with any
 * overrides) and is what all display components should read. The raw
 * `overrides` field (inherited from PlanExerciseClient) is kept alongside
 * so the UI can show a "customized" indicator and so the merge can be
 * recomputed later if overrides change.
 */
export interface PlanExerciseWithDefinition extends PlanExerciseClient {
    exerciseDef: ExerciseDefinitionClient;
}

/**
 * Weekly progress for a single exercise
 */
export interface ExerciseProgress {
    setsCompleted: number;
    isDone: boolean;
    /**
     * If true, the exercise is skipped for this week — its targetSets are
     * excluded from the week's total/completed set calculation. Per-week so
     * skipping one week doesn't affect other weeks.
     */
    isSkipped?: boolean;
}

/**
 * Combined data for a single plan (stored locally)
 */
export interface PlanData {
    /** Exercise templates with definitions */
    exercises: PlanExerciseWithDefinition[];
    /** Week progress: {weekNumber: {planExerciseId: ExerciseProgress}} */
    weekProgress: Record<number, Record<string, ExerciseProgress>>;
    /** Workout-specific sets: {weekNumber: {workoutId: {planExerciseId: setsCompleted}}} */
    workoutSets: Record<number, Record<string, Record<string, number>>>;
    /** Timestamp when data was last synced to server */
    lastSyncedAt: number | null;
    /** Whether local data has unsaved changes */
    isDirty: boolean;
}

/**
 * Conflict state for a plan (when server has newer changes)
 */
export interface PlanConflict {
    /** Server's last sync timestamp */
    serverLastSyncedAt: number;
    /** When the conflict was detected */
    detectedAt: number;
}

/**
 * Updates for an exercise (partial)
 */
export interface ExerciseUpdates {
    sets?: number;
    reps?: number;
    weight?: number;
    durationSeconds?: number;
    comments?: string;
}

/**
 * Override update for an exercise. Carries the new sparse overrides object
 * and the new merged exerciseDef (computed by the caller using the base def
 * from the exercise library). The store applies both atomically.
 */
export interface ExerciseOverrideUpdate {
    overrides: ExerciseDefinitionOverrides;
    mergedDef: ExerciseDefinitionClient;
}

/**
 * New exercise to add
 */
export interface NewExercise {
    _id?: string;
    exerciseDefId: string;
    exerciseDef: ExerciseDefinitionClient;
    sets: number;
    reps: number;
    weight?: number;
    durationSeconds?: number;
    comments?: string;
    /** Optional week scoping. Undefined = plan-wide; N = week N only. */
    weekNumber?: number;
}
