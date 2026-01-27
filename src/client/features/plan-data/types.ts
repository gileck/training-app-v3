/**
 * Plan Data Feature Types
 * 
 * Types for local-first plan data management.
 */

import type { PlanExerciseClient } from '@/server/database/collections/planExercises/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

/**
 * Overrides for exercise definition fields.
 * All fields are optional - only overridden fields are stored.
 * When displaying, merge these with the original definition.
 */
export interface ExerciseOverrides {
    name?: string;
    imageUrl?: string;
    primaryMuscle?: string;
    secondaryMuscles?: string[];
    type?: string;
    isBodyweight?: boolean;
    isStatic?: boolean;
}

/**
 * Exercise with its definition, used for display
 */
export interface PlanExerciseWithDefinition extends PlanExerciseClient {
    exerciseDef: ExerciseDefinitionClient;
    /** User overrides for exercise definition fields */
    overrides?: ExerciseOverrides;
}

/**
 * Weekly progress for a single exercise
 */
export interface ExerciseProgress {
    setsCompleted: number;
    isDone: boolean;
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
    overrides?: ExerciseOverrides;
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
    overrides?: ExerciseOverrides;
}
