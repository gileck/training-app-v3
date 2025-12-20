import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { ExerciseDefinition, ExerciseDefinitionCreate, ExerciseDefinitionUpdate } from './types';

/**
 * Get a reference to the exerciseDefinitions collection
 */
const getCollection = async (): Promise<Collection<ExerciseDefinition>> => {
    const db = await getDb();
    return db.collection<ExerciseDefinition>('exerciseDefinitions');
};

/**
 * Find all system exercises (shared across all users)
 */
export const findSystemExercises = async (): Promise<ExerciseDefinition[]> => {
    const collection = await getCollection();
    return collection.find({ isSystem: true }).sort({ name: 1 }).toArray();
};

/**
 * Find all custom exercises for a user
 */
export const findUserExercises = async (
    userId: ObjectId | string
): Promise<ExerciseDefinition[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return collection.find({ userId: userIdObj, isSystem: false }).sort({ name: 1 }).toArray();
};

/**
 * Find all exercises available to a user (system + custom)
 */
export const findAllExercises = async (
    userId: ObjectId | string
): Promise<ExerciseDefinition[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return collection
        .find({
            $or: [{ isSystem: true }, { userId: userIdObj }],
        })
        .sort({ name: 1 })
        .toArray();
};

/**
 * Find an exercise by ID
 */
export const findExerciseById = async (
    exerciseId: ObjectId | string
): Promise<ExerciseDefinition | null> => {
    const collection = await getCollection();
    const exerciseIdObj = typeof exerciseId === 'string' ? new ObjectId(exerciseId) : exerciseId;
    return collection.findOne({ _id: exerciseIdObj });
};

/**
 * Find multiple exercises by IDs
 */
export const findExercisesByIds = async (
    exerciseIds: (ObjectId | string)[]
): Promise<ExerciseDefinition[]> => {
    const collection = await getCollection();
    const ids = exerciseIds.map((id) => (typeof id === 'string' ? new ObjectId(id) : id));
    return collection.find({ _id: { $in: ids } }).toArray();
};

/**
 * Create a new exercise definition (for custom exercises)
 */
export const createExercise = async (
    exercise: ExerciseDefinitionCreate
): Promise<ExerciseDefinition> => {
    const collection = await getCollection();
    const result = await collection.insertOne(exercise as ExerciseDefinition);

    if (!result.insertedId) {
        throw new Error('Failed to create exercise definition');
    }

    return { ...exercise, _id: result.insertedId } as ExerciseDefinition;
};

/**
 * Bulk insert exercises (for migration)
 */
export const bulkInsertExercises = async (
    exercises: ExerciseDefinitionCreate[]
): Promise<number> => {
    const collection = await getCollection();
    const result = await collection.insertMany(exercises as ExerciseDefinition[]);
    return result.insertedCount;
};

/**
 * Update an existing exercise (only for custom exercises)
 */
export const updateExercise = async (
    exerciseId: ObjectId | string,
    userId: ObjectId | string,
    update: ExerciseDefinitionUpdate
): Promise<ExerciseDefinition | null> => {
    const collection = await getCollection();
    const exerciseIdObj = typeof exerciseId === 'string' ? new ObjectId(exerciseId) : exerciseId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Only allow updating user's own custom exercises
    const result = await collection.findOneAndUpdate(
        { _id: exerciseIdObj, userId: userIdObj, isSystem: false },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Delete a custom exercise
 */
export const deleteExercise = async (
    exerciseId: ObjectId | string,
    userId: ObjectId | string
): Promise<boolean> => {
    const collection = await getCollection();
    const exerciseIdObj = typeof exerciseId === 'string' ? new ObjectId(exerciseId) : exerciseId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Only allow deleting user's own custom exercises
    const result = await collection.deleteOne({
        _id: exerciseIdObj,
        userId: userIdObj,
        isSystem: false,
    });

    return result.deletedCount === 1;
};

