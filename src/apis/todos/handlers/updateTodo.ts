import { API_UPDATE_TODO } from '../index';
import { ApiHandlerContext, UpdateTodoRequest, UpdateTodoResponse } from '../types';
import { todos } from '@/server/database';

export const updateTodo = async (
    request: UpdateTodoRequest,
    context: ApiHandlerContext
): Promise<UpdateTodoResponse> => {
    try {
        if (!context.userId) {
            return { error: "Not authenticated" };
        }

        if (!request.todoId) {
            return { error: "Todo ID is required" };
        }

        if (!request.title && request.completed === undefined) {
            return { error: "No update data provided" };
        }

        // Prepare update data
        const updateData: {
            updatedAt: Date;
            title?: string;
            completed?: boolean;
        } = {
            updatedAt: new Date()
        };

        if (request.title !== undefined) {
            if (request.title.trim() === '') {
                return { error: "Title cannot be empty" };
            }
            updateData.title = request.title.trim();
        }

        if (request.completed !== undefined) {
            updateData.completed = request.completed;
        }

        const updatedTodo = await todos.updateTodo(request.todoId, context.userId, updateData);

        if (!updatedTodo) {
            return { error: "Todo not found" };
        }

        // Convert to client format
        const todoClient = {
            _id: updatedTodo._id.toHexString(),
            userId: updatedTodo.userId.toHexString(),
            title: updatedTodo.title,
            completed: updatedTodo.completed,
            createdAt: updatedTodo.createdAt.toISOString(),
            updatedAt: updatedTodo.updatedAt.toISOString()
        };

        return { todo: todoClient };
    } catch (error: unknown) {
        console.error("Update todo error:", error);
        return { error: error instanceof Error ? error.message : "Failed to update todo" };
    }
};

export { API_UPDATE_TODO }; 