import { API_CREATE_TODO } from '../index';
import { ApiHandlerContext, CreateTodoRequest, CreateTodoResponse } from '../types';
import { todos } from '@/server/database';
import { ObjectId } from 'mongodb';

export const createTodo = async (
    request: CreateTodoRequest,
    context: ApiHandlerContext
): Promise<CreateTodoResponse> => {
    try {
        if (!context.userId) {
            return { error: "Not authenticated" };
        }

        if (!request.title || request.title.trim() === '') {
            return { error: "Title is required" };
        }

        const now = new Date();
        const todoData = {
            userId: new ObjectId(context.userId),
            title: request.title.trim(),
            completed: false,
            createdAt: now,
            updatedAt: now
        };

        const newTodo = await todos.createTodo(todoData);

        // Convert to client format
        const todoClient = {
            _id: newTodo._id.toHexString(),
            userId: newTodo.userId.toHexString(),
            title: newTodo.title,
            completed: newTodo.completed,
            createdAt: newTodo.createdAt.toISOString(),
            updatedAt: newTodo.updatedAt.toISOString()
        };

        return { todo: todoClient };
    } catch (error: unknown) {
        console.error("Create todo error:", error);
        return { error: error instanceof Error ? error.message : "Failed to create todo" };
    }
};

export { API_CREATE_TODO }; 