import { API_GET_TODOS } from '../index';
import { ApiHandlerContext, GetTodosRequest, GetTodosResponse } from '../types';
import { todos } from '@/server/database';

export const getTodos = async (
    _: GetTodosRequest,
    context: ApiHandlerContext
): Promise<GetTodosResponse> => {
    try {
        if (!context.userId) {
            return { error: "Not authenticated" };
        }

        const todoList = await todos.findTodosByUserId(context.userId);

        // Convert to client format
        const todosClient = todoList.map(todo => ({
            _id: todo._id.toHexString(),
            userId: todo.userId.toHexString(),
            title: todo.title,
            completed: todo.completed,
            createdAt: todo.createdAt.toISOString(),
            updatedAt: todo.updatedAt.toISOString()
        }));

        return { todos: todosClient };
    } catch (error: unknown) {
        console.error("Get todos error:", error);
        return { error: error instanceof Error ? error.message : "Failed to get todos" };
    }
};

export { API_GET_TODOS }; 