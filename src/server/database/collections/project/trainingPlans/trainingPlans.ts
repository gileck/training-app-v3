import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database/connection';
import { TrainingPlan, TrainingPlanCreate, TrainingPlanUpdate } from './types';
import { toQueryId } from '@/server/template/utils';

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
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return collection.findOne({ _id: planIdQuery as ObjectId, userId: userIdObj });
};

/**
 * Create a new training plan
 * Supports client-generated UUIDs with idempotency check
 */
export const createPlan = async (plan: TrainingPlanCreate & { _id?: string }): Promise<TrainingPlan> => {
    const collection = await getCollection();

    // Idempotency: if client provided ID, check if already exists
    if (plan._id) {
        const existing = await collection.findOne({
            _id: toQueryId(plan._id) as ObjectId
        });
        if (existing) return existing;
    }

    // Insert with client ID or let MongoDB generate
    const doc = plan._id
        ? { ...plan, _id: plan._id as unknown as ObjectId }
        : plan;

    const result = await collection.insertOne(doc as TrainingPlan);

    if (!result.insertedId && !plan._id) {
        throw new Error('Failed to create training plan');
    }

    return { ...plan, _id: plan._id || result.insertedId } as unknown as TrainingPlan;
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
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.findOneAndUpdate(
        { _id: planIdQuery as ObjectId, userId: userIdObj },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Bump `plan.updatedAt` without any other change. Called by handlers that
 * mutate data belonging to this plan (exercises, workouts, progress, notes)
 * so the client's staleness check sees a single authoritative "something
 * under this plan changed" timestamp.
 *
 * Callers are expected to have already verified the plan belongs to the
 * acting user — this helper does not re-check.
 */
export const touchPlan = async (
    planId: ObjectId | string,
): Promise<void> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    await collection.updateOne(
        { _id: planIdQuery as ObjectId },
        { $set: { updatedAt: new Date() } },
    );
};

/**
 * Set a plan as active (and deactivate others)
 */
export const setActivePlan = async (
    planId: ObjectId | string,
    userId: ObjectId | string
): Promise<TrainingPlan | null> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Deactivate all other plans for this user
    await collection.updateMany(
        { userId: userIdObj, _id: { $ne: planIdQuery as ObjectId } },
        { $set: { isActive: false, updatedAt: new Date() } }
    );

    // Activate the selected plan
    const result = await collection.findOneAndUpdate(
        { _id: planIdQuery as ObjectId, userId: userIdObj },
        { $set: { isActive: true, updatedAt: new Date() } },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Find multiple training plans by IDs
 */
export const findPlansByIds = async (
    planIds: string[]
): Promise<TrainingPlan[]> => {
    const collection = await getCollection();
    const queryIds = planIds.map(id => toQueryId(id));
    return collection.find({ _id: { $in: queryIds as ObjectId[] } }).toArray();
};

/**
 * Delete a training plan
 */
export const deletePlan = async (
    planId: ObjectId | string,
    userId: ObjectId | string
): Promise<boolean> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.deleteOne({ _id: planIdQuery as ObjectId, userId: userIdObj });
    return result.deletedCount === 1;
};

/**
 * Update the lastDataSyncedAt timestamp for a plan
 */
export const updateLastDataSyncedAt = async (
    planId: ObjectId | string,
    timestamp: number
): Promise<void> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    
    await collection.updateOne(
        { _id: planIdQuery as ObjectId },
        { $set: { lastDataSyncedAt: timestamp } }
    );
};

/**
 * Get the lastDataSyncedAt timestamp for a plan
 */
export const getLastDataSyncedAt = async (
    planId: ObjectId | string
): Promise<number | null> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    
    const plan = await collection.findOne(
        { _id: planIdQuery as ObjectId },
        { projection: { lastDataSyncedAt: 1 } }
    );
    
    return plan?.lastDataSyncedAt ?? null;
};
