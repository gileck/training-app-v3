import { ObjectId } from 'mongodb';

/**
 * An item within a plan workout, referencing a planExercise
 * Accepts both ObjectId and string (UUID) to support client-generated IDs
 */
export interface PlanWorkoutItem {
    planExerciseId: ObjectId | string;
    order: number;
}

/**
 * A named, ordered group of planExerciseIds within a specific plan
 * Accepts both ObjectId and string (UUID) for ID fields to support client-generated IDs
 */
export interface PlanWorkout {
    _id: ObjectId | string;
    userId: ObjectId | string;
    planId: ObjectId | string;
    name: string;
    items: PlanWorkoutItem[];
    order: number;
    createdAt: Date;
    updatedAt: Date;
}

export type PlanWorkoutCreate = Omit<PlanWorkout, '_id' | 'createdAt' | 'updatedAt' | 'order'> & {
    order?: number;
    _id?: ObjectId | string;
};

export type PlanWorkoutUpdate = Partial<Omit<PlanWorkout, '_id' | 'userId' | 'planId' | 'createdAt'>> & {
    updatedAt: Date;
};

// Client types (string IDs instead of ObjectId)
export interface PlanWorkoutItemClient {
    planExerciseId: string;
    order: number;
}

export interface PlanWorkoutClient {
    _id: string;
    userId: string;
    planId: string;
    name: string;
    items: PlanWorkoutItemClient[];
    order: number;
    createdAt: string;
    updatedAt: string;
}
