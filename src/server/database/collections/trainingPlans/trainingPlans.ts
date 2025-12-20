import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { TrainingPlan, TrainingPlanCreate, TrainingPlanUpdate } from './types';

/**
 * Get a reference to the trainingPlans collection
 */
const getCollection = async (): Promise<Collection<TrainingPlan>> => {
    const db = await getDb();
    return db.collection<TrainingPlan>('trainingPlans');
};

/**
 * Find all training plans for a user
 */
export const findPlansByUserId = async (
    userId: ObjectId | string
): Promise<TrainingPlan[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return collection.find({ userId: userIdObj }).sort({ createdAt: -1 }).toArray();
};

/**
 * Find the active training plan for a user
 */
export const findActivePlan = async (
    userId: ObjectId | string
): Promise<TrainingPlan | null> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return collection.findOne({ userId: userIdObj, isActive: true });
};

/**
 * Find a training plan by ID
 */
export const findPlanById = async (
    planId: ObjectId | string,
    userId: ObjectId | string
): Promise<TrainingPlan | null> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return collection.findOne({ _id: planIdObj, userId: userIdObj });
};

/**
 * Create a new training plan
 */
export const createPlan = async (plan: TrainingPlanCreate): Promise<TrainingPlan> => {
    const collection = await getCollection();
    const result = await collection.insertOne(plan as TrainingPlan);

    if (!result.insertedId) {
        throw new Error('Failed to create training plan');
    }

    return { ...plan, _id: result.insertedId } as TrainingPlan;
};

/**
 * Update an existing training plan
 */
export const updatePlan = async (
    planId: ObjectId | string,
    userId: ObjectId | string,
    update: TrainingPlanUpdate
): Promise<TrainingPlan | null> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.findOneAndUpdate(
        { _id: planIdObj, userId: userIdObj },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Set a plan as active (and deactivate others)
 */
export const setActivePlan = async (
    planId: ObjectId | string,
    userId: ObjectId | string
): Promise<TrainingPlan | null> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Deactivate all other plans for this user
    await collection.updateMany(
        { userId: userIdObj, _id: { $ne: planIdObj } },
        { $set: { isActive: false, updatedAt: new Date() } }
    );

    // Activate the selected plan
    const result = await collection.findOneAndUpdate(
        { _id: planIdObj, userId: userIdObj },
        { $set: { isActive: true, updatedAt: new Date() } },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Delete a training plan
 */
export const deletePlan = async (
    planId: ObjectId | string,
    userId: ObjectId | string
): Promise<boolean> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.deleteOne({ _id: planIdObj, userId: userIdObj });
    return result.deletedCount === 1;
};

