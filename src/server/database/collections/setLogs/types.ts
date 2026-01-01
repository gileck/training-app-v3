import { ObjectId } from 'mongodb';

/**
 * Represents an individual set completion log
 * Each tap on a set button creates a new record
 * Accepts both ObjectId and string (UUID) for ID fields to support client-generated IDs
 */
export interface SetLog {
    _id: ObjectId | string;
    userId: ObjectId;
    planExerciseId: ObjectId | string;
    planId: ObjectId | string;
    weekNumber: number;
    setNumber: number;
    completedAt: Date;
}

/**
 * Type for creating a new set log
 */
export type SetLogCreate = Omit<SetLog, '_id'>;

/**
 * Client-friendly set log with string IDs
 */
export interface SetLogClient {
    _id: string;
    userId: string;
    planExerciseId: string;
    planId: string;
    weekNumber: number;
    setNumber: number;
    completedAt: string;
}


