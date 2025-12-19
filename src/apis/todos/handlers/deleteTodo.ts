import { API_DELETE_TODO } from '../index';
import { ApiHandlerContext, DeleteTodoRequest, DeleteTodoResponse } from '../types';
import { todos } from '@/server/database';

export const deleteTodo = async (
    request: DeleteTodoRequest,
    context: ApiHandlerContext
): Promise<DeleteTodoResponse> => {
    try {
        if (!context.userId) {
            return { error: "Not authenticated" };
        }

        if (!request.todoId) {
            return { error: "Todo ID is required" };
        }

        const deleted = await todos.deleteTodo(request.todoId, context.userId);

        if (!deleted) {
            return { error: "Todo not found" };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("Delete todo error:", error);
        return { error: error instanceof Error ? error.message : "Failed to delete todo" };
    }
};

export { API_DELETE_TODO }; 