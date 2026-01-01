import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database';
import { TodoItem, TodoItemCreate, TodoItemUpdate } from './types';
import { toQueryId } from '@/server/utils';

/**
 * Get a reference to the todos collection
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
 * @param todoId - The ID of the todo
 * @param userId - The ID of the user (for authorization)
 * @returns The todo item or null if not found
 */
export const findTodoById = async (
    todoId: ObjectId | string,
    userId: ObjectId | string
): Promise<TodoItem | null> => {
    const collection = await getTodosCollection();
    const todoIdQuery = typeof todoId === 'string' ? toQueryId(todoId) : todoId;
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return collection.findOne({ _id: todoIdQuery as ObjectId, userId: userIdObj });
};

/**
 * Create a new todo item
 * Supports client-generated UUIDs with idempotency check
 * @param todo - The todo data to create
 * @returns The created todo item
 */
export const createTodo = async (todo: TodoItemCreate & { _id?: string }): Promise<TodoItem> => {
    const collection = await getTodosCollection();

    // Idempotency: if client provided ID, check if already exists
    if (todo._id) {
        const existing = await collection.findOne({
            _id: toQueryId(todo._id) as ObjectId
        });
        if (existing) return existing;
    }

    // Insert with client ID or let MongoDB generate
    const doc = todo._id
        ? { ...todo, _id: todo._id as unknown as ObjectId }
        : todo;

    const result = await collection.insertOne(doc as TodoItem);

    if (!result.insertedId && !todo._id) {
        throw new Error('Failed to create todo item');
    }

    return { ...todo, _id: todo._id || result.insertedId } as unknown as TodoItem;
};

/**
 * Update an existing todo item
 * @param todoId - The ID of the todo to update
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

    const result = await collection.findOneAndUpdate(
        { _id: todoIdQuery as ObjectId, userId: userIdObj },
        { $set: update },
        { returnDocument: 'after' }
    );

    return result || null;
};

/**
 * Delete a todo item
 * @param todoId - The ID of the todo to delete
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

    const result = await collection.deleteOne({ _id: todoIdQuery as ObjectId, userId: userIdObj });
    return result.deletedCount === 1;
};
