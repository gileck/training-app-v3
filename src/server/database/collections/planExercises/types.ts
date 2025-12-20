import { ObjectId } from 'mongodb';

/**
 * Represents an exercise configuration within a training plan
 */
export interface PlanExercise {
    _id: ObjectId;
    planId: ObjectId;
    exerciseDefId: ObjectId;
    sets: number;
    reps: number;
    weight: number; // in kg
    durationSeconds: number; // for static/timed exercises
    comments: string;
    order: number;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new plan exercise
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
    createdAt: string;
    updatedAt: string;
}

