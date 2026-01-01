import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { PlanExercise, PlanExerciseCreate, PlanExerciseUpdate } from './types';
import { toQueryId } from '../../utils';

/**
 * Get a reference to the planExercises collection
 */
const getCollection = async (): Promise<Collection<PlanExercise>> => {
    const db = await getDb();
    return db.collection<PlanExercise>('planExercises');
};

/**
 * Find all exercises for a plan
 */
export const findExercisesByPlanId = async (
    planId: ObjectId | string
): Promise<PlanExercise[]> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    return collection.find({ planId: planIdQuery as ObjectId }).sort({ order: 1 }).toArray();
};

/**
 * Find a plan exercise by ID
 */
export const findPlanExerciseById = async (
    planExerciseId: ObjectId | string
): Promise<PlanExercise | null> => {
    const collection = await getCollection();
    const idQuery = typeof planExerciseId === 'string' ? toQueryId(planExerciseId) : planExerciseId;
    return collection.findOne({ _id: idQuery as ObjectId });
};

/**
 * Check if an exercise is already in a plan
 */
export const isExerciseInPlan = async (
    planId: ObjectId | string,
    exerciseDefId: ObjectId | string
): Promise<boolean> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    const exerciseDefIdObj =
        typeof exerciseDefId === 'string' ? new ObjectId(exerciseDefId) : exerciseDefId;
    const count = await collection.countDocuments({ planId: planIdQuery as ObjectId, exerciseDefId: exerciseDefIdObj });
    return count > 0;
};

/**
 * Get the next order number for a plan
 */
export const getNextOrder = async (planId: ObjectId | string): Promise<number> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    const lastExercise = await collection
        .find({ planId: planIdQuery as ObjectId })
        .sort({ order: -1 })
        .limit(1)
        .toArray();
    return lastExercise.length > 0 ? lastExercise[0].order + 1 : 0;
};

/**
 * Create a new plan exercise
 * Supports client-generated UUIDs with idempotency check
 */
export const createPlanExercise = async (
    exercise: PlanExerciseCreate & { _id?: string }
): Promise<PlanExercise> => {
    const collection = await getCollection();

    // Idempotency: if client provided ID, check if already exists
    if (exercise._id) {
        const existing = await collection.findOne({
            _id: toQueryId(exercise._id) as ObjectId
        });
        if (existing) return existing;
    }

    // Insert with client ID or let MongoDB generate
    const doc = exercise._id
        ? { ...exercise, _id: exercise._id as unknown as ObjectId }
        : exercise;

    const result = await collection.insertOne(doc as PlanExercise);

    if (!result.insertedId && !exercise._id) {
        throw new Error('Failed to create plan exercise');
    }

    return { ...exercise, _id: exercise._id || result.insertedId } as unknown as PlanExercise;
};

/**
 * Update an existing plan exercise
 */
export const updatePlanExercise = async (
    planExerciseId: ObjectId | string,
    update: PlanExerciseUpdate
): Promise<PlanExercise | null> => {
    const collection = await getCollection();
    const idQuery = typeof planExerciseId === 'string' ? toQueryId(planExerciseId) : planExerciseId;

    const result = await collection.findOneAndUpdate(
        { _id: idQuery as ObjectId },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Delete a plan exercise
 */
export const deletePlanExercise = async (
    planExerciseId: ObjectId | string
): Promise<boolean> => {
    const collection = await getCollection();
    const idQuery = typeof planExerciseId === 'string' ? toQueryId(planExerciseId) : planExerciseId;
    const result = await collection.deleteOne({ _id: idQuery as ObjectId });
    return result.deletedCount === 1;
};

/**
 * Delete all exercises for a plan (used when deleting a plan)
 */
export const deleteExercisesByPlanId = async (
    planId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    const result = await collection.deleteMany({ planId: planIdQuery as ObjectId });
    return result.deletedCount;
};

/**
 * Reorder exercises in a plan
 */
export const reorderExercises = async (
    planId: ObjectId | string,
    exerciseIds: string[]
): Promise<void> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;

    const bulkOps = exerciseIds.map((id, index) => ({
        updateOne: {
            filter: { _id: toQueryId(id) as ObjectId, planId: planIdQuery as ObjectId },
            update: { $set: { order: index, updatedAt: new Date() } },
        },
    }));

    if (bulkOps.length > 0) {
        await collection.bulkWrite(bulkOps);
    }
};

/**
 * Count exercises in a plan
 */
export const countExercisesByPlanId = async (
    planId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const planIdQuery = typeof planId === 'string' ? toQueryId(planId) : planId;
    return collection.countDocuments({ planId: planIdQuery as ObjectId });
};

/**
 * Find all plan exercises using a specific exercise definition
 * Used to check if an exercise can be deleted
 */
export const findPlanExercisesByExerciseDefId = async (
    exerciseDefId: ObjectId | string
): Promise<PlanExercise[]> => {
    const collection = await getCollection();
    const exerciseDefIdObj =
        typeof exerciseDefId === 'string' ? new ObjectId(exerciseDefId) : exerciseDefId;
    return collection.find({ exerciseDefId: exerciseDefIdObj }).toArray();
};
