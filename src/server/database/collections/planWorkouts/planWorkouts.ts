import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { PlanWorkout, PlanWorkoutCreate, PlanWorkoutUpdate } from './types';

/**
 * RECOMMENDED INDEXES (not enforced at runtime):
 * - { userId: 1, planId: 1, order: 1 }
 * - { userId: 1, planId: 1, _id: 1 }
 */

/**
 * Get a reference to the planWorkouts collection
 */
const getCollection = async (): Promise<Collection<PlanWorkout>> => {
    const db = await getDb();
    return db.collection<PlanWorkout>('planWorkouts');
};

/**
 * Find all plan workouts for a user within a specific plan
 */
export const listPlanWorkouts = async (
    userId: ObjectId | string,
    planId: ObjectId | string
): Promise<PlanWorkout[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    return collection
        .find({ userId: userIdObj, planId: planIdObj })
        .sort({ order: 1, updatedAt: -1 })
        .toArray();
};

/**
 * Find a plan workout by ID (scoped to user and plan)
 */
export const getPlanWorkout = async (
    workoutId: ObjectId | string,
    userId: ObjectId | string,
    planId: ObjectId | string
): Promise<PlanWorkout | null> => {
    const collection = await getCollection();
    const workoutIdObj = typeof workoutId === 'string' ? new ObjectId(workoutId) : workoutId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    return collection.findOne({
        _id: workoutIdObj,
        userId: userIdObj,
        planId: planIdObj,
    });
};

/**
 * Create a new plan workout
 * Items order is normalized to 0..n-1
 */
export const createPlanWorkout = async (workout: PlanWorkoutCreate): Promise<PlanWorkout> => {
    const collection = await getCollection();
    const now = new Date();

    // Get the next order number for this plan
    const existingCount = await collection.countDocuments({
        userId: workout.userId,
        planId: workout.planId,
    });

    // Normalize item order to 0..n-1
    const normalizedItems = workout.items.map((item, index) => ({
        ...item,
        order: index,
    }));

    const workoutWithDates = {
        ...workout,
        items: normalizedItems,
        order: workout.order ?? existingCount,
        createdAt: now,
        updatedAt: now,
    } as PlanWorkout;

    const result = await collection.insertOne(workoutWithDates);

    if (!result.insertedId) {
        throw new Error('Failed to create plan workout');
    }

    return { ...workoutWithDates, _id: result.insertedId };
};

/**
 * Update an existing plan workout
 * If items are provided, order is normalized to 0..n-1
 */
export const updatePlanWorkout = async (
    workoutId: ObjectId | string,
    userId: ObjectId | string,
    planId: ObjectId | string,
    update: PlanWorkoutUpdate
): Promise<PlanWorkout | null> => {
    const collection = await getCollection();
    const workoutIdObj = typeof workoutId === 'string' ? new ObjectId(workoutId) : workoutId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;

    // Normalize item order if items are being updated
    const normalizedUpdate = { ...update };
    if (normalizedUpdate.items) {
        normalizedUpdate.items = normalizedUpdate.items.map((item, index) => ({
            ...item,
            order: index,
        }));
    }

    const result = await collection.findOneAndUpdate(
        { _id: workoutIdObj, userId: userIdObj, planId: planIdObj },
        { $set: normalizedUpdate },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Delete a plan workout
 */
export const deletePlanWorkout = async (
    workoutId: ObjectId | string,
    userId: ObjectId | string,
    planId: ObjectId | string
): Promise<boolean> => {
    const collection = await getCollection();
    const workoutIdObj = typeof workoutId === 'string' ? new ObjectId(workoutId) : workoutId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;

    const result = await collection.deleteOne({
        _id: workoutIdObj,
        userId: userIdObj,
        planId: planIdObj,
    });
    return result.deletedCount === 1;
};

/**
 * Delete all plan workouts for a plan (used when deleting a plan)
 */
export const deletePlanWorkoutsByPlanId = async (
    planId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const result = await collection.deleteMany({ planId: planIdObj });
    return result.deletedCount;
};

/**
 * Reorder plan workouts by updating their order field
 */
export const reorderPlanWorkouts = async (
    userId: ObjectId | string,
    planId: ObjectId | string,
    workoutIds: string[]
): Promise<boolean> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const now = new Date();

    // Update each workout's order based on its position in the array
    const operations = workoutIds.map((workoutId, index) => ({
        updateOne: {
            filter: {
                _id: new ObjectId(workoutId),
                userId: userIdObj,
                planId: planIdObj,
            },
            update: { $set: { order: index, updatedAt: now } },
        },
    }));

    const result = await collection.bulkWrite(operations);
    return result.modifiedCount === workoutIds.length;
};

/**
 * Count plan workouts for a user within a plan
 */
export const countPlanWorkouts = async (
    userId: ObjectId | string,
    planId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    return collection.countDocuments({ userId: userIdObj, planId: planIdObj });
};
