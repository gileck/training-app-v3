import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { WeeklyProgress, WeeklyProgressCreate } from './types';
import { toQueryId } from '@/server/utils';

/**
 * Get a reference to the weeklyProgress collection
 */
const getCollection = async (): Promise<Collection<WeeklyProgress>> => {
    const db = await getDb();
    return db.collection<WeeklyProgress>('weeklyProgress');
};

/**
 * Helper to convert ObjectId | string to query format
 */
const toQuery = (id: ObjectId | string): ObjectId | string => {
    return typeof id === 'string' ? toQueryId(id) : id;
};

/**
 * Find weekly progress by plan and week number
 */
export const findWeeklyProgress = async (
    planId: ObjectId | string,
    weekNumber: number
): Promise<WeeklyProgress | null> => {
    const collection = await getCollection();
    return collection.findOne({ planId: toQuery(planId), weekNumber });
};

/**
 * Find or create weekly progress for a plan/week
 */
export const findOrCreateWeeklyProgress = async (
    planId: ObjectId | string,
    weekNumber: number
): Promise<WeeklyProgress> => {
    const collection = await getCollection();
    const planIdQuery = toQuery(planId);

    const existing = await collection.findOne({ planId: planIdQuery, weekNumber });
    if (existing) {
        return existing;
    }

    const now = new Date();
    const newProgress: WeeklyProgressCreate = {
        planId: planIdQuery,
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
    return collection.find({ planId: toQuery(planId) }).sort({ weekNumber: 1 }).toArray();
};

/**
 * Delete all weekly progress for a plan (used when deleting a plan)
 */
export const deleteWeeklyProgressByPlanId = async (
    planId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const result = await collection.deleteMany({ planId: toQuery(planId) });
    return result.deletedCount;
};


