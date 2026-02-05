import { ObjectId } from 'mongodb';

/**
 * Represents weekly notes/comments for a specific exercise in a training plan week.
 * Notes are tied to an exercise definition (not plan exercise) so they can be
 * viewed across weeks for the same exercise type.
 */
export interface WeeklyNote {
    _id: ObjectId;
    userId: ObjectId;
    planId: ObjectId;
    exerciseDefId: ObjectId; // Links to exercise definition
    weekNumber: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Type for creating a new weekly note
 */
export type WeeklyNoteCreate = Omit<WeeklyNote, '_id'>;

/**
 * Type for updating a weekly note
 */
export type WeeklyNoteUpdate = Partial<Pick<WeeklyNote, 'content' | 'updatedAt'>>;

/**
 * Client-friendly weekly note with string IDs
 */
export interface WeeklyNoteClient {
    _id: string;
    userId: string;
    planId: string;
    exerciseDefId: string;
    weekNumber: number;
    content: string;
    createdAt: string;
    updatedAt: string;
}

