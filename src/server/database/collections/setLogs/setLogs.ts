import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { SetLog, SetLogCreate } from './types';
import { toQueryId } from '../../utils';

/**
 * Get a reference to the setLogs collection
 */
const getCollection = async (): Promise<Collection<SetLog>> => {
    const db = await getDb();
    return db.collection<SetLog>('setLogs');
};

/**
 * Create a new set log (when user taps to complete a set)
 * Supports client-generated UUIDs with idempotency check
 */
export const createSetLog = async (log: SetLogCreate & { _id?: string }): Promise<SetLog> => {
    const collection = await getCollection();

    // Idempotency: if client provided ID, check if already exists
    if (log._id) {
        const existing = await collection.findOne({
            _id: toQueryId(log._id) as ObjectId
        });
        if (existing) return existing;
    }

    // Insert with client ID or let MongoDB generate
    const doc = log._id
        ? { ...log, _id: log._id as unknown as ObjectId }
        : log;

    const result = await collection.insertOne(doc as SetLog);

    if (!result.insertedId && !log._id) {
        throw new Error('Failed to create set log');
    }

    return { ...log, _id: log._id || result.insertedId } as unknown as SetLog;
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
    const planExerciseIdQuery =
        typeof planExerciseId === 'string' ? toQueryId(planExerciseId) : planExerciseId;

    // Find the most recent log
    const latestLog = await collection
        .find({ userId: userIdObj, planExerciseId: planExerciseIdQuery as ObjectId, weekNumber })
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
    const planExerciseIdQuery =
        typeof planExerciseId === 'string' ? toQueryId(planExerciseId) : planExerciseId;

    return collection.countDocuments({
        userId: userIdObj,
        planExerciseId: planExerciseIdQuery as ObjectId,
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
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;

    return collection
        .find({ userId: userIdObj, planId: planIdQuery as ObjectId, weekNumber })
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

    // Add 1 day to endDate and use $lt to include the entire end date
    const endDateExclusive = new Date(endDate);
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);

    return collection
        .find({
            userId: userIdObj,
            completedAt: { $gte: startDate, $lt: endDateExclusive },
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
    const setLogIdQuery = typeof setLogId === 'string' ? toQueryId(setLogId) : setLogId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.deleteOne({ _id: setLogIdQuery as ObjectId, userId: userIdObj });
    return result.deletedCount === 1;
};

/**
 * Delete all set logs for a plan exercise (when removing from plan)
 */
export const deleteSetLogsByPlanExerciseId = async (
    planExerciseId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const planExerciseIdQuery =
        typeof planExerciseId === 'string' ? toQueryId(planExerciseId) : planExerciseId;
    const result = await collection.deleteMany({ planExerciseId: planExerciseIdQuery as ObjectId });
    return result.deletedCount;
};

/**
 * Delete all set logs for a plan (when deleting a plan)
 */
export const deleteSetLogsByPlanId = async (planId: ObjectId | string): Promise<number> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    const result = await collection.deleteMany({ planId: planIdQuery as ObjectId });
    return result.deletedCount;
};

/**
 * Find set logs by arbitrary filter
 */
export const findSetLogsByFilter = async (
    filter: Record<string, unknown>,
    limit = 100
): Promise<SetLog[]> => {
    const collection = await getCollection();
    return collection.find(filter).sort({ completedAt: -1 }).limit(limit).toArray();
};

/**
 * Count set logs by arbitrary filter
 */
export const countSetLogsByFilter = async (filter: Record<string, unknown>): Promise<number> => {
    const collection = await getCollection();
    return collection.countDocuments(filter);
};

/**
 * Get set logs for a specific exercise definition (across all plan exercises)
 * Returns recent set completions for an exercise type
 */
export const findSetLogsByExerciseDefId = async (
    userId: ObjectId | string,
    exerciseDefId: string,
    planExerciseIds: string[],
    limit = 50
): Promise<SetLog[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planExerciseIdQueries = planExerciseIds.map(id => toQueryId(id));

    return collection
        .find({
            userId: userIdObj,
            planExerciseId: { $in: planExerciseIdQueries as ObjectId[] },
        })
        .sort({ completedAt: -1 })
        .limit(limit)
        .toArray();
};

/**
 * Update a set log's completedAt date
 */
export const updateSetLogDate = async (
    setLogId: ObjectId | string,
    userId: ObjectId | string,
    completedAt: Date
): Promise<boolean> => {
    const collection = await getCollection();
    const setLogIdQuery = typeof setLogId === 'string' ? toQueryId(setLogId) : setLogId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.updateOne(
        { _id: setLogIdQuery as ObjectId, userId: userIdObj },
        { $set: { completedAt } }
    );
    return result.modifiedCount === 1;
};

/**
 * Delete multiple set logs by IDs
 */
export const deleteSetLogsBulk = async (
    setLogIds: (ObjectId | string)[],
    userId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const setLogIdQueries = setLogIds.map(id => typeof id === 'string' ? toQueryId(id) : id);
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.deleteMany({
        _id: { $in: setLogIdQueries as ObjectId[] },
        userId: userIdObj,
    });
    return result.deletedCount;
};

/**
 * Find a single set log by ID
 */
export const findSetLogById = async (
    setLogId: ObjectId | string,
    userId: ObjectId | string
): Promise<SetLog | null> => {
    const collection = await getCollection();
    const setLogIdQuery = typeof setLogId === 'string' ? toQueryId(setLogId) : setLogId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return collection.findOne({ _id: setLogIdQuery as ObjectId, userId: userIdObj });
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

    // Add 1 day to endDate and use $lt to include the entire end date
    const endDateExclusive = new Date(endDate);
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);

    const pipeline = [
        {
            $match: {
                userId: userIdObj,
                completedAt: { $gte: startDate, $lt: endDateExclusive },
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
