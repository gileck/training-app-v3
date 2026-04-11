import { ObjectId } from 'mongodb';

/**
 * Sparse override of the base exercise definition, stored on the plan
 * exercise. Only keys whose values differ from the base are kept. Applied
 * via mergeExerciseDef(base, overrides) at display time.
 *
 * Kept as an inline type rather than importing the client-side type so the
 * DB schema module does not depend on client code.
 */
export interface PlanExerciseOverrides {
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
    /**
     * Optional per-instance overrides of the base exercise definition.
     * Empty/undefined means "no customization — use the base def as-is".
     */
    overrides?: PlanExerciseOverrides;
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
    /** Optional per-instance overrides of the base exercise definition. */
    overrides?: PlanExerciseOverrides;
    createdAt: string;
    updatedAt: string;
}


