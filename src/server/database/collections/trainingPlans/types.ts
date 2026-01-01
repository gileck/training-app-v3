import { ObjectId } from 'mongodb';

/**
 * Represents a training plan in the system
 */
export interface TrainingPlan {
    _id: ObjectId | string;
    userId: ObjectId | string;
    name: string;
    durationWeeks: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new training plan
 */
export type TrainingPlanCreate = Omit<TrainingPlan, '_id'> & { _id?: ObjectId | string };

/**
 * Type for updating a training plan
 */
export type TrainingPlanUpdate = Partial<Omit<TrainingPlan, '_id' | 'userId'>> & {
    updatedAt: Date;
};

/**
 * Client-friendly training plan with string IDs
 */
export interface TrainingPlanClient {
    _id: string;
    userId: string;
    name: string;
    durationWeeks: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}


