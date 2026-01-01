import { API_CREATE_TODO } from '../index';
import { ApiHandlerContext, CreateTodoRequest, CreateTodoResponse } from '../types';
import { todos } from '@/server/database';
import { toStringId, toDocumentId } from '@/server/utils';

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
            _id: request._id, // Pass client-generated ID if provided
            userId: toDocumentId(context.userId),
            title: request.title.trim(),
            completed: false,
            createdAt: now,
            updatedAt: now
        };

        const newTodo = await todos.createTodo(todoData);

        // Convert to client format (handle both ObjectId and UUID string)
        const todoClient = {
            _id: toStringId(newTodo._id),
            userId: toStringId(newTodo.userId),
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
