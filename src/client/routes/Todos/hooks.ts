/**
 * Todo-specific React Query hooks
 * 
 * These hooks are SIMPLE - no cache config here.
 * - Cache config lives in `src/client/query/defaults.ts`
 * - Offline handling is abstracted at the apiClient level
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getTodos, getTodo, createTodo, updateTodo, deleteTodo } from '@/apis/todos/client';
import { useQueryDefaults } from '@/client/query/defaults';
import type {
    GetTodosResponse,
    GetTodoResponse,
    CreateTodoRequest,
    UpdateTodoRequest,
    DeleteTodoRequest,
} from '@/apis/todos/types';
import type { TodoItemClient } from '@/server/database/collections/todos/types';

// ============================================================================
// Query Keys
// ============================================================================

export const todosQueryKey = ['todos'] as const;
export const todoQueryKey = (todoId: string) => ['todos', todoId] as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all todos for the current user
 */
export function useTodos(options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: todosQueryKey,
        queryFn: async (): Promise<GetTodosResponse> => {
            const response = await getTodos({});
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults,
    });
}

/**
 * Hook to fetch a single todo by ID
 */
export function useTodo(todoId: string, options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults();

    return useQuery({
        queryKey: todoQueryKey(todoId),
        queryFn: async (): Promise<GetTodoResponse> => {
            const response = await getTodo({ todoId });
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: (options?.enabled ?? true) && !!todoId,
        ...queryDefaults,
    });
}

/**
 * Hook to invalidate todos queries
 */
export function useInvalidateTodos() {
    const queryClient = useQueryClient();

    return {
        invalidateAll: () => queryClient.invalidateQueries({ queryKey: todosQueryKey }),
        invalidateOne: (todoId: string) => queryClient.invalidateQueries({ queryKey: todoQueryKey(todoId) }),
    };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for creating a new todo
 */
export function useCreateTodo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateTodoRequest) => {
            const response = await createTodo(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.todo;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: todosQueryKey });
            const previousTodos = queryClient.getQueryData<GetTodosResponse>(todosQueryKey);

            // Optimistic update
            const optimisticTodo: TodoItemClient = {
                _id: `temp-${Date.now()}`,
                title: variables.title,
                completed: false,
                userId: 'temp',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<GetTodosResponse>(todosQueryKey, (old) => {
                if (!old?.todos) return { todos: [optimisticTodo] };
                return { todos: [...old.todos, optimisticTodo] };
            });

            return { previousTodos };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(todosQueryKey, context.previousTodos);
            }
        },
        // Guard against empty data (offline mode returns {})
        onSuccess: (newTodo) => {
            if (newTodo) {
                queryClient.setQueryData<GetTodosResponse>(todosQueryKey, (old) => {
                    if (!old?.todos) return { todos: [newTodo] };
                    const filtered = old.todos.filter(t => !t._id.startsWith('temp-'));
                    return { todos: [...filtered, newTodo] };
                });
            }
        },
    });
}

/**
 * Hook for updating an existing todo
 */
export function useUpdateTodo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateTodoRequest) => {
            const response = await updateTodo(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.todo;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: todosQueryKey });
            const previousTodos = queryClient.getQueryData<GetTodosResponse>(todosQueryKey);

            // Optimistic update
            queryClient.setQueryData<GetTodosResponse>(todosQueryKey, (old) => {
                if (!old?.todos) return old;
                return {
                    todos: old.todos.map((todo) =>
                        todo._id === variables.todoId
                            ? { ...todo, ...variables, updatedAt: new Date().toISOString() }
                            : todo
                    ),
                };
            });

            return { previousTodos };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(todosQueryKey, context.previousTodos);
            }
        },
        // Guard against empty data (offline mode returns {})
        onSuccess: (updatedTodo) => {
            if (updatedTodo) {
                queryClient.setQueryData(todoQueryKey(updatedTodo._id), { todo: updatedTodo });
            }
        },
    });
}

/**
 * Hook for deleting a todo
 */
export function useDeleteTodo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: DeleteTodoRequest) => {
            const response = await deleteTodo(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return data.todoId;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: todosQueryKey });
            const previousTodos = queryClient.getQueryData<GetTodosResponse>(todosQueryKey);

            // Optimistic update
            queryClient.setQueryData<GetTodosResponse>(todosQueryKey, (old) => {
                if (!old?.todos) return old;
                return {
                    todos: old.todos.filter((todo) => todo._id !== variables.todoId),
                };
            });

            return { previousTodos };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(todosQueryKey, context.previousTodos);
            }
        },
        // Guard against empty data (offline mode returns {})
        onSuccess: (deletedTodoId) => {
            if (deletedTodoId) {
                queryClient.removeQueries({ queryKey: todoQueryKey(deletedTodoId) });
            }
        },
    });
}
