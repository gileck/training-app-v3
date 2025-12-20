import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { SetLog, SetLogCreate } from './types';

/**
 * Get a reference to the setLogs collection
 */
const getCollection = async (): Promise<Collection<SetLog>> => {
    const db = await getDb();
    return db.collection<SetLog>('setLogs');
};

/**
 * Create a new set log (when user taps to complete a set)
 */
export const createSetLog = async (log: SetLogCreate): Promise<SetLog> => {
    const collection = await getCollection();
    const result = await collection.insertOne(log as SetLog);

    if (!result.insertedId) {
        throw new Error('Failed to create set log');
    }

    return { ...log, _id: result.insertedId } as SetLog;
};

/**
 * Delete the most recent set log for an exercise/week (when user untaps a set)
 */
export const deleteLatestSetLog = async (
    userId: ObjectId | string,
    planExerciseId: ObjectId | string,
    weekNumber: number
): Promise<boolean> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planExerciseIdObj =
        typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;

    // Find the most recent log
    const latestLog = await collection
        .find({ userId: userIdObj, planExerciseId: planExerciseIdObj, weekNumber })
        .sort({ completedAt: -1 })
        .limit(1)
        .toArray();

    if (latestLog.length === 0) {
        return false;
    }

    const result = await collection.deleteOne({ _id: latestLog[0]._id });
    return result.deletedCount === 1;
};

/**
 * Count sets completed for an exercise in a specific week
 */
export const countSetsForExerciseWeek = async (
    userId: ObjectId | string,
    planExerciseId: ObjectId | string,
    weekNumber: number
): Promise<number> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planExerciseIdObj =
        typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;

    return collection.countDocuments({
        userId: userIdObj,
        planExerciseId: planExerciseIdObj,
        weekNumber,
    });
};

/**
 * Get all set logs for a user's plan/week
 */
export const findSetLogsByPlanWeek = async (
    userId: ObjectId | string,
    planId: ObjectId | string,
    weekNumber: number
): Promise<SetLog[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;

    return collection
        .find({ userId: userIdObj, planId: planIdObj, weekNumber })
        .sort({ completedAt: 1 })
        .toArray();
};

/**
 * Get set logs for a user within a date range (for activity log)
 */
export const findSetLogsByDateRange = async (
    userId: ObjectId | string,
    startDate: Date,
    endDate: Date,
    limit = 100,
    skip = 0
): Promise<SetLog[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return collection
        .find({
            userId: userIdObj,
            completedAt: { $gte: startDate, $lte: endDate },
        })
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
};

/**
 * Delete a specific set log by ID
 */
export const deleteSetLog = async (
    setLogId: ObjectId | string,
    userId: ObjectId | string
): Promise<boolean> => {
    const collection = await getCollection();
    const setLogIdObj = typeof setLogId === 'string' ? new ObjectId(setLogId) : setLogId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.deleteOne({ _id: setLogIdObj, userId: userIdObj });
    return result.deletedCount === 1;
};

/**
 * Delete all set logs for a plan exercise (when removing from plan)
 */
export const deleteSetLogsByPlanExerciseId = async (
    planExerciseId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const planExerciseIdObj =
        typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;
    const result = await collection.deleteMany({ planExerciseId: planExerciseIdObj });
    return result.deletedCount;
};

/**
 * Delete all set logs for a plan (when deleting a plan)
 */
export const deleteSetLogsByPlanId = async (planId: ObjectId | string): Promise<number> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const result = await collection.deleteMany({ planId: planIdObj });
    return result.deletedCount;
};

/**
 * Get aggregated stats per day (for charts)
 */
export const getSetStatsPerDay = async (
    userId: ObjectId | string,
    startDate: Date,
    endDate: Date
): Promise<{ date: string; count: number }[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const pipeline = [
        {
            $match: {
                userId: userIdObj,
                completedAt: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
                },
                count: { $sum: 1 },
            },
        },
        {
            $sort: { _id: 1 as const },
        },
        {
            $project: {
                _id: 0,
                date: '$_id',
                count: 1,
            },
        },
    ];

    return collection.aggregate<{ date: string; count: number }>(pipeline).toArray();
};

