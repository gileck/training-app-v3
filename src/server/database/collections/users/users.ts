import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { User, UserCreate, UserUpdate } from './types';

/**
 * Get a reference to the users collection
 */
const getUsersCollection = async (): Promise<Collection<User>> => {
  const db = await getDb();
  return db.collection<User>('users');
};

/**
 * Find a user by ID
 * @param userId - The ID of the user
 * @returns The user document or null if not found
 */
export const findUserById = async (
  userId: ObjectId | string
): Promise<User | null> => {
  const collection = await getUsersCollection();
  const idObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

  return collection.findOne({ _id: idObj });
};

/**
 * Find a user by username
 * @param username - The username to search for
 * @returns The user document or null if not found
 */
export const findUserByUsername = async (
  username: string
): Promise<User | null> => {
  const collection = await getUsersCollection();
  return collection.findOne({ username });
};

/**
 * Find a user by email
 * @param email - The email to search for
 * @returns The user document or null if not found
 */
export const findUserByEmail = async (
  email: string
): Promise<User | null> => {
  const collection = await getUsersCollection();
  return collection.findOne({ email });
};

/**
 * Insert a new user
 * @param user - The user data to insert
 * @returns The inserted user with _id
 * @throws Error if a user with the same username or email already exists
 */
export const insertUser = async (user: UserCreate): Promise<User> => {
  const collection = await getUsersCollection();

  // Check if username already exists
  const existingUsername = await collection.findOne({ username: user.username });
  if (existingUsername) {
    throw new Error(`User with username "${user.username}" already exists`);
  }

  // Check if email already exists (only if email is provided)
  if (user.email) {
    const existingEmail = await collection.findOne({ email: user.email });
    if (existingEmail) {
      throw new Error(`User with email "${user.email}" already exists`);
    }
  }

  const result = await collection.insertOne(user as User);

  if (!result.insertedId) {
    throw new Error('Failed to insert user');
  }

  return { ...user, _id: result.insertedId } as User;
};

/**
 * Update an existing user
 * @param userId - The ID of the user to update
 * @param update - The update data
 * @returns The updated user or null if not found
 * @throws Error if attempting to update username/email to one that already exists
 */
export const updateUser = async (
  userId: ObjectId | string,
  update: UserUpdate
): Promise<User | null> => {
  const collection = await getUsersCollection();
  const idObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

  // If username is being updated, check if it already exists
  if (update.username) {
    const existingUsername = await collection.findOne({
      username: update.username,
      _id: { $ne: idObj }
    });

    if (existingUsername) {
      throw new Error(`User with username "${update.username}" already exists`);
    }
  }

  // If email is being updated, check if it already exists
  if (update.email) {
    const existingEmail = await collection.findOne({
      email: update.email,
      _id: { $ne: idObj }
    });

    if (existingEmail) {
      throw new Error(`User with email "${update.email}" already exists`);
    }
  }

  const result = await collection.findOneAndUpdate(
    { _id: idObj },
    { $set: update },
    { returnDocument: 'after' }
  );

  return result || null;
};

/**
 * Delete a user
 * @param userId - The ID of the user to delete
 * @returns True if the user was deleted, false otherwise
 */
export const deleteUser = async (
  userId: ObjectId | string
): Promise<boolean> => {
  const collection = await getUsersCollection();
  const idObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

  const result = await collection.deleteOne({ _id: idObj });
  return result.deletedCount === 1;
}; 