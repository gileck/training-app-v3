import { ObjectId } from 'mongodb';

/**
 * Tracks sets completed within a specific workout
 */
export interface WorkoutSetsCompleted {
    workoutId: string;
    setsCompleted: number;
}

/**
 * Represents progress for a specific exercise within a week
 * Accepts both ObjectId and string (UUID) for ID fields to support client-generated IDs
 */
export interface ExerciseProgress {
    _id: ObjectId | string;
    weeklyProgressId: ObjectId | string;
    planExerciseId: ObjectId | string;
    setsCompleted: number;  // Total sets (all workouts + floating)
    workoutSets: WorkoutSetsCompleted[];  // Per-workout breakdown
    isDone: boolean;
    updatedAt: Date;
}

/**
 * Type for creating a new exercise progress
 */
export type ExerciseProgressCreate = Omit<ExerciseProgress, '_id'>;

/**
 * Type for updating exercise progress
 */
export type ExerciseProgressUpdate = Partial<
    Omit<ExerciseProgress, '_id' | 'weeklyProgressId' | 'planExerciseId'>
>;

/**
 * Client-friendly exercise progress with string IDs
 */
export interface ExerciseProgressClient {
    _id: string;
    weeklyProgressId: string;
    planExerciseId: string;
    setsCompleted: number;  // Total sets (all workouts + floating)
    workoutSets: WorkoutSetsCompleted[];  // Per-workout breakdown
    isDone: boolean;
    updatedAt: string;
}


