import { ObjectId } from 'mongodb';

/**
 * Represents weekly progress tracking for a training plan
 */
export interface WeeklyProgress {
    _id: ObjectId;
    planId: ObjectId;
    weekNumber: number;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new weekly progress
 */
export type WeeklyProgressCreate = Omit<WeeklyProgress, '_id'>;

/**
 * Client-friendly weekly progress with string IDs
 */
export interface WeeklyProgressClient {
    _id: string;
    planId: string;
    weekNumber: number;
    createdAt: string;
    updatedAt: string;
}


