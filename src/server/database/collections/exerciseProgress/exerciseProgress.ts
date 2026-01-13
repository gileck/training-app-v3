import { Collection } from 'mongodb';
import { getDb } from '@/server/database';
import { ExerciseProgress, ExerciseProgressCreate, ExerciseProgressUpdate } from './types';
import { toQueryId } from '@/server/utils';

/**
 * Get a reference to the exerciseProgress collection
 */
const getCollection = async (): Promise<Collection<ExerciseProgress>> => {
    const db = await getDb();
    return db.collection<ExerciseProgress>('exerciseProgress');
};

/**
 * Find all exercise progress for a weekly progress
 */
export const findExerciseProgressByWeekId = async (
    weeklyProgressId: string
): Promise<ExerciseProgress[]> => {
    const collection = await getCollection();
    return collection.find({ weeklyProgressId: toQueryId(weeklyProgressId) }).toArray();
};

/**
 * Find exercise progress for a specific exercise within a week
 */
export const findExerciseProgress = async (
    weeklyProgressId: string,
    planExerciseId: string
): Promise<ExerciseProgress | null> => {
    const collection = await getCollection();
    return collection.findOne({
        weeklyProgressId: toQueryId(weeklyProgressId),
        planExerciseId: toQueryId(planExerciseId),
    });
};

/**
 * Find or create exercise progress
 */
export const findOrCreateExerciseProgress = async (
    weeklyProgressId: string,
    planExerciseId: string
): Promise<ExerciseProgress> => {
    const collection = await getCollection();
    const weeklyProgressIdQuery = toQueryId(weeklyProgressId);
    const planExerciseIdQuery = toQueryId(planExerciseId);

    const existing = await collection.findOne({
        weeklyProgressId: weeklyProgressIdQuery,
        planExerciseId: planExerciseIdQuery,
    });
    if (existing) {
        return existing;
    }

    const newProgress: ExerciseProgressCreate = {
        weeklyProgressId: weeklyProgressIdQuery,
        planExerciseId: planExerciseIdQuery,
        setsCompleted: 0,
        isDone: false,
        updatedAt: new Date(),
    };

    const result = await collection.insertOne(newProgress as ExerciseProgress);
    return { ...newProgress, _id: result.insertedId } as ExerciseProgress;
};

/**
 * Update exercise progress
 */
export const updateExerciseProgress = async (
    weeklyProgressId: string,
    planExerciseId: string,
    update: ExerciseProgressUpdate
): Promise<ExerciseProgress | null> => {
    const collection = await getCollection();

    const result = await collection.findOneAndUpdate(
        { weeklyProgressId: toQueryId(weeklyProgressId), planExerciseId: toQueryId(planExerciseId) },
        { $set: { ...update, updatedAt: new Date() } },
        { returnDocument: 'after', upsert: true }
    );

    return result || null;
};

/**
 * Delete all exercise progress for a weekly progress (cascade delete)
 */
export const deleteExerciseProgressByWeekId = async (
    weeklyProgressId: string
): Promise<number> => {
    const collection = await getCollection();
    const result = await collection.deleteMany({ weeklyProgressId: toQueryId(weeklyProgressId) });
    return result.deletedCount;
};

/**
 * Delete all exercise progress for a plan exercise (when removing from plan)
 */
export const deleteExerciseProgressByPlanExerciseId = async (
    planExerciseId: string
): Promise<number> => {
    const collection = await getCollection();
    const result = await collection.deleteMany({ planExerciseId: toQueryId(planExerciseId) });
    return result.deletedCount;
};

/**
 * Atomically increment setsCompleted by 1, respecting max bound.
 * Uses MongoDB $inc operator to prevent race conditions from rapid clicks.
 * Returns the updated document, or null if already at max.
 */
export const atomicIncrementSets = async (
    weeklyProgressId: string,
    planExerciseId: string,
    maxSets: number
): Promise<ExerciseProgress | null> => {
    const collection = await getCollection();

    // Atomically increment only if current value is below max
    const result = await collection.findOneAndUpdate(
        {
            weeklyProgressId: toQueryId(weeklyProgressId),
            planExerciseId: toQueryId(planExerciseId),
            setsCompleted: { $lt: maxSets },
        },
        {
            $inc: { setsCompleted: 1 },
            $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Atomically decrement setsCompleted by 1, respecting min bound of 0.
 * Uses MongoDB $inc operator to prevent race conditions from rapid clicks.
 * Returns the updated document, or null if already at 0.
 */
export const atomicDecrementSets = async (
    weeklyProgressId: string,
    planExerciseId: string
): Promise<ExerciseProgress | null> => {
    const collection = await getCollection();

    // Atomically decrement only if current value is above 0
    const result = await collection.findOneAndUpdate(
        {
            weeklyProgressId: toQueryId(weeklyProgressId),
            planExerciseId: toQueryId(planExerciseId),
            setsCompleted: { $gt: 0 },
        },
        {
            $inc: { setsCompleted: -1 },
            $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' }
    );

    return result || null;
};


