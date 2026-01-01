import { API_CREATE_TODO } from '../index';
import { ApiHandlerContext, CreateTodoRequest, CreateTodoResponse } from '../types';
import { todos } from '@/server/database';
import { ObjectId } from 'mongodb';
import { toDocumentId, toStringId, toQueryId } from '@/server/utils';

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

        // If client provided an ID, check for idempotency (handle retries)
        if (request._id) {
            const existing = await todos.findTodoById(request._id, context.userId);
            if (existing) {
                // Return existing todo (idempotent - same ID = same result)
                return {
                    todo: {
                        _id: toStringId(existing._id),
                        userId: toStringId(existing.userId),
                        title: existing.title,
                        completed: existing.completed,
                        createdAt: existing.createdAt.toISOString(),
                        updatedAt: existing.updatedAt.toISOString()
                    }
                };
            }
        }

        const now = new Date();
        const todoData = {
            // Use client-provided ID (UUID or ObjectId format) or generate new one
            _id: request._id ? toDocumentId(request._id) : new ObjectId(),
            userId: toQueryId(context.userId) as ObjectId,
            title: request.title.trim(),
            completed: false,
            createdAt: now,
            updatedAt: now
        };

        const newTodo = await todos.createTodoWithId(todoData);

        // Convert to client format
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