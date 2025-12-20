import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { ExerciseProgress, ExerciseProgressCreate, ExerciseProgressUpdate } from './types';

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
    weeklyProgressId: ObjectId | string
): Promise<ExerciseProgress[]> => {
    const collection = await getCollection();
    const weeklyProgressIdObj =
        typeof weeklyProgressId === 'string' ? new ObjectId(weeklyProgressId) : weeklyProgressId;
    return collection.find({ weeklyProgressId: weeklyProgressIdObj }).toArray();
};

/**
 * Find exercise progress for a specific exercise within a week
 */
export const findExerciseProgress = async (
    weeklyProgressId: ObjectId | string,
    planExerciseId: ObjectId | string
): Promise<ExerciseProgress | null> => {
    const collection = await getCollection();
    const weeklyProgressIdObj =
        typeof weeklyProgressId === 'string' ? new ObjectId(weeklyProgressId) : weeklyProgressId;
    const planExerciseIdObj =
        typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;
    return collection.findOne({
        weeklyProgressId: weeklyProgressIdObj,
        planExerciseId: planExerciseIdObj,
    });
};

/**
 * Find or create exercise progress
 */
export const findOrCreateExerciseProgress = async (
    weeklyProgressId: ObjectId | string,
    planExerciseId: ObjectId | string
): Promise<ExerciseProgress> => {
    const collection = await getCollection();
    const weeklyProgressIdObj =
        typeof weeklyProgressId === 'string' ? new ObjectId(weeklyProgressId) : weeklyProgressId;
    const planExerciseIdObj =
        typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;

    const existing = await collection.findOne({
        weeklyProgressId: weeklyProgressIdObj,
        planExerciseId: planExerciseIdObj,
    });
    if (existing) {
        return existing;
    }

    const newProgress: ExerciseProgressCreate = {
        weeklyProgressId: weeklyProgressIdObj,
        planExerciseId: planExerciseIdObj,
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
    weeklyProgressId: ObjectId | string,
    planExerciseId: ObjectId | string,
    update: ExerciseProgressUpdate
): Promise<ExerciseProgress | null> => {
    const collection = await getCollection();
    const weeklyProgressIdObj =
        typeof weeklyProgressId === 'string' ? new ObjectId(weeklyProgressId) : weeklyProgressId;
    const planExerciseIdObj =
        typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;

    const result = await collection.findOneAndUpdate(
        { weeklyProgressId: weeklyProgressIdObj, planExerciseId: planExerciseIdObj },
        { $set: { ...update, updatedAt: new Date() } },
        { returnDocument: 'after', upsert: true }
    );

    return result || null;
};

/**
 * Delete all exercise progress for a weekly progress (cascade delete)
 */
export const deleteExerciseProgressByWeekId = async (
    weeklyProgressId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const weeklyProgressIdObj =
        typeof weeklyProgressId === 'string' ? new ObjectId(weeklyProgressId) : weeklyProgressId;
    const result = await collection.deleteMany({ weeklyProgressId: weeklyProgressIdObj });
    return result.deletedCount;
};

/**
 * Delete all exercise progress for a plan exercise (when removing from plan)
 */
export const deleteExerciseProgressByPlanExerciseId = async (
    planExerciseId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const planExerciseIdObj =
        typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;
    const result = await collection.deleteMany({ planExerciseId: planExerciseIdObj });
    return result.deletedCount;
};


