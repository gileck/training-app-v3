import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { SavedWorkout, SavedWorkoutCreate, SavedWorkoutUpdate } from './types';

/**
 * Get a reference to the savedWorkouts collection
 */
const getCollection = async (): Promise<Collection<SavedWorkout>> => {
    const db = await getDb();
    return db.collection<SavedWorkout>('savedWorkouts');
};

/**
 * Find all saved workouts for a user
 */
export const findWorkoutsByUserId = async (
    userId: ObjectId | string
): Promise<SavedWorkout[]> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return collection.find({ userId: userIdObj }).sort({ updatedAt: -1 }).toArray();
};

/**
 * Find a saved workout by ID
 */
export const findWorkoutById = async (
    workoutId: ObjectId | string,
    userId: ObjectId | string
): Promise<SavedWorkout | null> => {
    const collection = await getCollection();
    const workoutIdObj = typeof workoutId === 'string' ? new ObjectId(workoutId) : workoutId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return collection.findOne({ _id: workoutIdObj, userId: userIdObj });
};

/**
 * Create a new saved workout
 */
export const createWorkout = async (workout: SavedWorkoutCreate): Promise<SavedWorkout> => {
    const collection = await getCollection();
    const now = new Date();
    const workoutWithDates = {
        ...workout,
        createdAt: now,
        updatedAt: now,
    } as SavedWorkout;

    const result = await collection.insertOne(workoutWithDates);

    if (!result.insertedId) {
        throw new Error('Failed to create saved workout');
    }

    return { ...workoutWithDates, _id: result.insertedId };
};

/**
 * Update an existing saved workout
 */
export const updateWorkout = async (
    workoutId: ObjectId | string,
    userId: ObjectId | string,
    update: SavedWorkoutUpdate
): Promise<SavedWorkout | null> => {
    const collection = await getCollection();
    const workoutIdObj = typeof workoutId === 'string' ? new ObjectId(workoutId) : workoutId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.findOneAndUpdate(
        { _id: workoutIdObj, userId: userIdObj },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Delete a saved workout
 */
export const deleteWorkout = async (
    workoutId: ObjectId | string,
    userId: ObjectId | string
): Promise<boolean> => {
    const collection = await getCollection();
    const workoutIdObj = typeof workoutId === 'string' ? new ObjectId(workoutId) : workoutId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await collection.deleteOne({ _id: workoutIdObj, userId: userIdObj });
    return result.deletedCount === 1;
};

/**
 * Count saved workouts for a user
 */
export const countWorkoutsByUserId = async (
    userId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return collection.countDocuments({ userId: userIdObj });
};


