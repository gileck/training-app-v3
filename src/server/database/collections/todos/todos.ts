import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { toQueryId } from '@/server/utils';
import { TodoItem, TodoItemCreate, TodoItemUpdate } from './types';

/**
 * Get a reference to the todos collection
 * Note: Collection type uses ObjectId but _id can also be a string (UUID)
 */
const getTodosCollection = async (): Promise<Collection<TodoItem>> => {
    const db = await getDb();
    return db.collection<TodoItem>('todos');
};

/**
 * Find all todos for a user
 * @param userId - The ID of the user
 * @returns Array of todo items
 */
export const findTodosByUserId = async (
    userId: ObjectId | string
): Promise<TodoItem[]> => {
    const collection = await getTodosCollection();
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return collection.find({ userId: userIdObj }).sort({ createdAt: -1 }).toArray();
};

/**
 * Find a todo by ID
 * Supports both ObjectId and UUID string formats
 * @param todoId - The ID of the todo (ObjectId or UUID string)
 * @param userId - The ID of the user (for authorization)
 * @returns The todo item or null if not found
 */
export const findTodoById = async (
    todoId: ObjectId | string,
    userId: ObjectId | string
): Promise<TodoItem | null> => {
    const collection = await getTodosCollection();
    // Use toQueryId to handle both ObjectId and UUID formats
    const todoIdQuery = typeof todoId === 'string' ? toQueryId(todoId) : todoId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // TypeScript doesn't know that toQueryId() returns ObjectId | string compatible with MongoDB's _id
    // This assertion is safe because MongoDB accepts both ObjectId and string for _id queries
    return collection.findOne({ _id: todoIdQuery, userId: userIdObj } as Parameters<typeof collection.findOne>[0]);
};

/**
 * Create a new todo item (MongoDB generates ID)
 * @param todo - The todo data to create
 * @returns The created todo item
 */
export const createTodo = async (todo: TodoItemCreate): Promise<TodoItem> => {
    const collection = await getTodosCollection();

    const result = await collection.insertOne(todo as TodoItem);

    if (!result.insertedId) {
        throw new Error('Failed to create todo item');
    }

    return { ...todo, _id: result.insertedId } as TodoItem;
};

/**
 * Todo data with flexible _id type (ObjectId or string UUID)
 */
interface TodoItemWithFlexId extends Omit<TodoItem, '_id'> {
    _id: ObjectId | string;
}

/**
 * Create a new todo item with a specific ID (for client-generated IDs)
 * Supports both ObjectId and UUID string formats for _id
 * @param todo - The todo data including _id (can be ObjectId or UUID string)
 * @returns The created todo item
 */
export const createTodoWithId = async (todo: TodoItemWithFlexId): Promise<TodoItem> => {
    const collection = await getTodosCollection();

    // MongoDB's insertOne accepts documents with flexible _id types (string or ObjectId)
    const result = await collection.insertOne(todo as TodoItem);

    if (!result.insertedId) {
        throw new Error('Failed to create todo item');
    }

    // Return with the _id that was actually inserted
    return { ...todo, _id: result.insertedId } as unknown as TodoItem;
};

/**
 * Update an existing todo item
 * Supports both ObjectId and UUID string formats
 * @param todoId - The ID of the todo to update (ObjectId or UUID string)
 * @param userId - The ID of the user (for authorization)
 * @param update - The update data
 * @returns The updated todo item or null if not found
 */
export const updateTodo = async (
    todoId: ObjectId | string,
    userId: ObjectId | string,
    update: TodoItemUpdate
): Promise<TodoItem | null> => {
    const collection = await getTodosCollection();
    const todoIdQuery = typeof todoId === 'string' ? toQueryId(todoId) : todoId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // TypeScript doesn't know that toQueryId() returns ObjectId | string compatible with MongoDB's _id
    // This assertion is safe because MongoDB accepts both ObjectId and string for _id queries
    const result = await collection.findOneAndUpdate(
        { _id: todoIdQuery, userId: userIdObj } as Parameters<typeof collection.findOneAndUpdate>[0],
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Delete a todo item
 * Supports both ObjectId and UUID string formats
 * @param todoId - The ID of the todo to delete (ObjectId or UUID string)
 * @param userId - The ID of the user (for authorization)
 * @returns True if the todo was deleted, false otherwise
 */
export const deleteTodo = async (
    todoId: ObjectId | string,
    userId: ObjectId | string
): Promise<boolean> => {
    const collection = await getTodosCollection();
    const todoIdQuery = typeof todoId === 'string' ? toQueryId(todoId) : todoId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // TypeScript doesn't know that toQueryId() returns ObjectId | string compatible with MongoDB's _id
    // This assertion is safe because MongoDB accepts both ObjectId and string for _id queries
    const result = await collection.deleteOne({ _id: todoIdQuery, userId: userIdObj } as Parameters<typeof collection.deleteOne>[0]);
    return result.deletedCount === 1;
}; 