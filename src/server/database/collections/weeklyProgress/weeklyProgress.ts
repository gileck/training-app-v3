import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { WeeklyProgress, WeeklyProgressCreate } from './types';

/**
 * Get a reference to the weeklyProgress collection
 */
const getCollection = async (): Promise<Collection<WeeklyProgress>> => {
    const db = await getDb();
    return db.collection<WeeklyProgress>('weeklyProgress');
};

/**
 * Find weekly progress by plan and week number
 */
export const findWeeklyProgress = async (
    planId: ObjectId | string,
    weekNumber: number
): Promise<WeeklyProgress | null> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    return collection.findOne({ planId: planIdObj, weekNumber });
};

/**
 * Find or create weekly progress for a plan/week
 */
export const findOrCreateWeeklyProgress = async (
    planId: ObjectId | string,
    weekNumber: number
): Promise<WeeklyProgress> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;

    const existing = await collection.findOne({ planId: planIdObj, weekNumber });
    if (existing) {
        return existing;
    }

    const now = new Date();
    const newProgress: WeeklyProgressCreate = {
        planId: planIdObj,
        weekNumber,
        createdAt: now,
        updatedAt: now,
    };

    const result = await collection.insertOne(newProgress as WeeklyProgress);
    return { ...newProgress, _id: result.insertedId } as WeeklyProgress;
};

/**
 * Find all weekly progress for a plan
 */
export const findAllWeeklyProgress = async (
    planId: ObjectId | string
): Promise<WeeklyProgress[]> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    return collection.find({ planId: planIdObj }).sort({ weekNumber: 1 }).toArray();
};

/**
 * Delete all weekly progress for a plan (used when deleting a plan)
 */
export const deleteWeeklyProgressByPlanId = async (
    planId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const result = await collection.deleteMany({ planId: planIdObj });
    return result.deletedCount;
};


