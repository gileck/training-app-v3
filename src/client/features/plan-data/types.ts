/**
 * Plan Data Feature Types
 * 
 * Types for local-first plan data management.
 */

import type { PlanExerciseClient } from '@/server/database/collections/planExercises/types';
import type { ExerciseDefinitionClient } from '@/server/database/collections/exerciseDefinitions/types';

/**
 * Exercise with its definition, used for display
 */
export interface PlanExerciseWithDefinition extends PlanExerciseClient {
    exerciseDef: ExerciseDefinitionClient;
}

/**
 * Tracks sets completed within a specific workout
 */
export interface WorkoutSetsProgress {
    workoutId: string;
    setsCompleted: number;
}

/**
 * Weekly progress for a single exercise
 */
export interface ExerciseProgress {
    setsCompleted: number;  // Total sets (all workouts + floating)
    workoutSets: WorkoutSetsProgress[];  // Per-workout breakdown
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
}
