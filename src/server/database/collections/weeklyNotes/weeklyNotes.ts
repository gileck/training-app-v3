import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { WeeklyNote, WeeklyNoteClient } from './types';

/**
 * Get a reference to the weeklyNotes collection
 */
const getCollection = async (): Promise<Collection<WeeklyNote>> => {
    const db = await getDb();
    return db.collection<WeeklyNote>('weeklyNotes');
};

/**
 * Convert WeeklyNote to WeeklyNoteClient
 */
export const toClient = (note: WeeklyNote): WeeklyNoteClient => ({
    _id: note._id.toHexString(),
    userId: note.userId.toHexString(),
    planId: note.planId.toHexString(),
    exerciseDefId: note.exerciseDefId.toHexString(),
    weekNumber: note.weekNumber,
    content: note.content,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
});

/**
 * Find a weekly note for a specific exercise in a plan/week
 */
export const findNote = async (
    userId: ObjectId | string,
    planId: ObjectId | string,
    exerciseDefId: ObjectId | string,
    weekNumber: number
): Promise<WeeklyNote | null> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const exerciseDefIdObj = typeof exerciseDefId === 'string' ? new ObjectId(exerciseDefId) : exerciseDefId;

    return collection.findOne({
        userId: userIdObj,
        planId: planIdObj,
        exerciseDefId: exerciseDefIdObj,
        weekNumber,
    });
};

/**
 * Create or update a weekly note for an exercise (upsert)
 */
export const upsertNote = async (
    userId: ObjectId | string,
    planId: ObjectId | string,
    exerciseDefId: ObjectId | string,
    weekNumber: number,
    content: string
): Promise<WeeklyNote> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const exerciseDefIdObj = typeof exerciseDefId === 'string' ? new ObjectId(exerciseDefId) : exerciseDefId;

    const now = new Date();

    const result = await collection.findOneAndUpdate(
        {
            userId: userIdObj,
            planId: planIdObj,
            exerciseDefId: exerciseDefIdObj,
            weekNumber,
        },
        {
            $set: {
                content,
                updatedAt: now,
            },
            $setOnInsert: {
                userId: userIdObj,
                planId: planIdObj,
                exerciseDefId: exerciseDefIdObj,
                weekNumber,
                createdAt: now,
            },
        },
        {
            upsert: true,
            returnDocument: 'after',
        }
    );

    return result!;
};

/**
 * Find all notes for a specific exercise across all weeks (for history)
 */
export const findNotesByExercise = async (
    userId: ObjectId | string,
    planId: ObjectId | string,
    exerciseDefId: ObjectId | string
): Promise<WeeklyNote[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const exerciseDefIdObj = typeof exerciseDefId === 'string' ? new ObjectId(exerciseDefId) : exerciseDefId;

    return collection
        .find({ userId: userIdObj, planId: planIdObj, exerciseDefId: exerciseDefIdObj })
        .sort({ weekNumber: -1 }) // Most recent first
        .toArray();
};

/**
 * Find all notes for a plan
 */
export const findNotesByPlan = async (
    userId: ObjectId | string,
    planId: ObjectId | string
): Promise<WeeklyNote[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;

    return collection
        .find({ userId: userIdObj, planId: planIdObj })
        .sort({ weekNumber: 1 })
        .toArray();
};

/**
 * Delete a weekly note for an exercise
 */
export const deleteNote = async (
    userId: ObjectId | string,
    planId: ObjectId | string,
    exerciseDefId: ObjectId | string,
    weekNumber: number
): Promise<boolean> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const exerciseDefIdObj = typeof exerciseDefId === 'string' ? new ObjectId(exerciseDefId) : exerciseDefId;

    const result = await collection.deleteOne({
        userId: userIdObj,
        planId: planIdObj,
        exerciseDefId: exerciseDefIdObj,
        weekNumber,
    });

    return result.deletedCount === 1;
};

/**
 * Delete all notes for a plan (when deleting a plan)
 */
export const deleteNotesByPlanId = async (
    planId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;

    const result = await collection.deleteMany({ planId: planIdObj });
    return result.deletedCount;
};

