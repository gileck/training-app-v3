import { ObjectId } from 'mongodb';

/**
 * An item within a plan workout, referencing a planExercise
 */
export interface PlanWorkoutItem {
    planExerciseId: ObjectId;
    order: number;
}

/**
 * A named, ordered group of planExerciseIds within a specific plan
 */
export interface PlanWorkout {
    _id: ObjectId;
    userId: ObjectId;
    planId: ObjectId;
    name: string;
    items: PlanWorkoutItem[];
    order: number;
    createdAt: Date;
    updatedAt: Date;
}

export type PlanWorkoutCreate = Omit<PlanWorkout, '_id' | 'createdAt' | 'updatedAt' | 'order'> & {
    order?: number;
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
