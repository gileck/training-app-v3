import { ObjectId } from 'mongodb';

/**
 * Overrides for exercise definition fields (stored per plan exercise)
 */
export interface ExerciseOverridesDb {
    name?: string;
    imageUrl?: string;
    primaryMuscle?: string;
    secondaryMuscles?: string[];
    type?: string;
    isBodyweight?: boolean;
    isStatic?: boolean;
}

/**
 * Represents an exercise configuration within a training plan
 */
export interface PlanExercise {
    _id: ObjectId | string;
    planId: ObjectId | string;
    exerciseDefId: ObjectId | string;
    sets: number;
    reps: number;
    weight: number; // in kg
    durationSeconds: number; // for static/timed exercises
    comments: string;
    order: number;
    /** User overrides for exercise definition fields */
    overrides?: ExerciseOverridesDb;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new plan exercise
 * Accepts both ObjectId and string (UUID) for ID fields to support client-generated IDs
 */
export type PlanExerciseCreate = Omit<PlanExercise, '_id'>;

/**
 * Type for updating a plan exercise
 */
export type PlanExerciseUpdate = Partial<
    Omit<PlanExercise, '_id' | 'planId' | 'exerciseDefId'>
> & {
    updatedAt: Date;
};

/**
 * Client-friendly overrides
 */
export interface ExerciseOverridesClient {
    name?: string;
    imageUrl?: string;
    primaryMuscle?: string;
    secondaryMuscles?: string[];
    type?: string;
    isBodyweight?: boolean;
    isStatic?: boolean;
}

/**
 * Client-friendly plan exercise with string IDs
 */
export interface PlanExerciseClient {
    _id: string;
    planId: string;
    exerciseDefId: string;
    sets: number;
    reps: number;
    weight: number;
    durationSeconds: number;
    comments: string;
    order: number;
    /** User overrides for exercise definition fields */
    overrides?: ExerciseOverridesClient;
    createdAt: string;
    updatedAt: string;
}


