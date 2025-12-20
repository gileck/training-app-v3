import { ObjectId } from 'mongodb';

/**
 * Represents progress for a specific exercise within a week
 */
export interface ExerciseProgress {
    _id: ObjectId;
    weeklyProgressId: ObjectId;
    planExerciseId: ObjectId;
    setsCompleted: number;
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
    setsCompleted: number;
    isDone: boolean;
    updatedAt: string;
}


