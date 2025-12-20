import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { PlanExercise, PlanExerciseCreate, PlanExerciseUpdate } from './types';

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
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    return collection.find({ planId: planIdObj }).sort({ order: 1 }).toArray();
};

/**
 * Find a plan exercise by ID
 */
export const findPlanExerciseById = async (
    planExerciseId: ObjectId | string
): Promise<PlanExercise | null> => {
    const collection = await getCollection();
    const id = typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;
    return collection.findOne({ _id: id });
};

/**
 * Check if an exercise is already in a plan
 */
export const isExerciseInPlan = async (
    planId: ObjectId | string,
    exerciseDefId: ObjectId | string
): Promise<boolean> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const exerciseDefIdObj =
        typeof exerciseDefId === 'string' ? new ObjectId(exerciseDefId) : exerciseDefId;
    const count = await collection.countDocuments({ planId: planIdObj, exerciseDefId: exerciseDefIdObj });
    return count > 0;
};

/**
 * Get the next order number for a plan
 */
export const getNextOrder = async (planId: ObjectId | string): Promise<number> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const lastExercise = await collection
        .find({ planId: planIdObj })
        .sort({ order: -1 })
        .limit(1)
        .toArray();
    return lastExercise.length > 0 ? lastExercise[0].order + 1 : 0;
};

/**
 * Create a new plan exercise
 */
export const createPlanExercise = async (
    exercise: PlanExerciseCreate
): Promise<PlanExercise> => {
    const collection = await getCollection();
    const result = await collection.insertOne(exercise as PlanExercise);

    if (!result.insertedId) {
        throw new Error('Failed to create plan exercise');
    }

    return { ...exercise, _id: result.insertedId } as PlanExercise;
};

/**
 * Update an existing plan exercise
 */
export const updatePlanExercise = async (
    planExerciseId: ObjectId | string,
    update: PlanExerciseUpdate
): Promise<PlanExercise | null> => {
    const collection = await getCollection();
    const id = typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;

    const result = await collection.findOneAndUpdate(
        { _id: id },
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
    const id = typeof planExerciseId === 'string' ? new ObjectId(planExerciseId) : planExerciseId;
    const result = await collection.deleteOne({ _id: id });
    return result.deletedCount === 1;
};

/**
 * Delete all exercises for a plan (used when deleting a plan)
 */
export const deleteExercisesByPlanId = async (
    planId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    const result = await collection.deleteMany({ planId: planIdObj });
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
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;

    const bulkOps = exerciseIds.map((id, index) => ({
        updateOne: {
            filter: { _id: new ObjectId(id), planId: planIdObj },
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
    const planIdObj = typeof planId === 'string' ? new ObjectId(planId) : planId;
    return collection.countDocuments({ planId: planIdObj });
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

