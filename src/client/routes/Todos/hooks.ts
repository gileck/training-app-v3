/**
 * Todo-specific React Query hooks
 * 
 * These hooks are SIMPLE - no cache config here.
 * - Cache config lives in `src/client/query/defaults.ts`
 * - Offline handling is abstracted at the apiClient level
 * 
 * ============================================================================
 * OPTIMISTIC-ONLY UI PATTERN (CRITICAL - READ CAREFULLY)
 * ============================================================================
 * 
 * All mutations use OPTIMISTIC UPDATES for instant UI feedback.
 * 
 * **RULE: NEVER update UI from server responses on SUCCESS.**
 * 
 * Why? Race conditions:
 *   1. User creates todo → UI shows new todo (optimistic)
 *   2. User deletes it quickly → UI removes todo (optimistic)
 *   3. Server response for create arrives → UI would re-add deleted todo (WRONG!)
 * 
 * Solution:
 *   - `onMutate`: Update UI immediately (this IS the source of truth)
 *   - `onSuccess`: Do NOT call invalidateQueries or setQueryData
 *   - `onError`: ONLY on error - rollback to previous state
 *   - `onSettled`: NEVER refetch - optimistic state is already correct
 * ============================================================================
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
import { generateId } from '@/client/utils/generateId';

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
 * 
 * Uses OPTIMISTIC-ONLY pattern with client-generated UUID:
 * - Client generates stable UUID that server persists
 * - UI updates immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
 * - Idempotent: retries with same ID won't create duplicates
 */
export function useCreateTodo() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (data: CreateTodoRequest & { _id: string }) => {
            const response = await createTodo(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.todo;
        },
        // OPTIMISTIC UPDATE: Add todo immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables: CreateTodoRequest & { _id: string }) => {
            await queryClient.cancelQueries({ queryKey: todosQueryKey });
            const previousTodos = queryClient.getQueryData<GetTodosResponse>(todosQueryKey);

            // Create optimistic todo with client-generated UUID
            const optimisticTodo: TodoItemClient = {
                _id: variables._id,
                title: variables.title,
                completed: false,
                userId: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            queryClient.setQueryData<GetTodosResponse>(todosQueryKey, (old) => {
                if (!old?.todos) return { todos: [optimisticTodo] };
                return { todos: [...old.todos, optimisticTodo] };
            });

            return { previousTodos };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(todosQueryKey, context.previousTodos);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });

    // Wrap mutate to inject client-generated ID
    return {
        ...mutation,
        mutate: (data: CreateTodoRequest, options?: Parameters<typeof mutation.mutate>[1]) => {
            return mutation.mutate({ ...data, _id: generateId() }, options);
        },
        mutateAsync: async (data: CreateTodoRequest, options?: Parameters<typeof mutation.mutateAsync>[1]) => {
            return mutation.mutateAsync({ ...data, _id: generateId() }, options);
        },
    };
}

/**
 * Hook for updating an existing todo
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI updates item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
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
        // OPTIMISTIC UPDATE: Update todo immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: todosQueryKey });
            const previousTodos = queryClient.getQueryData<GetTodosResponse>(todosQueryKey);

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
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(todosQueryKey, context.previousTodos);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}

/**
 * Hook for deleting a todo
 * 
 * Uses OPTIMISTIC-ONLY pattern:
 * - UI removes item immediately in onMutate
 * - Server response is IGNORED on success (prevents race conditions)
 * - Only on ERROR do we rollback to previous state
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
        // OPTIMISTIC UPDATE: Remove todo immediately - THIS IS THE SOURCE OF TRUTH
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: todosQueryKey });
            const previousTodos = queryClient.getQueryData<GetTodosResponse>(todosQueryKey);

            queryClient.setQueryData<GetTodosResponse>(todosQueryKey, (old) => {
                if (!old?.todos) return old;
                return {
                    todos: old.todos.filter((todo) => todo._id !== variables.todoId),
                };
            });

            // Also clear single todo query
            queryClient.removeQueries({ queryKey: todoQueryKey(variables.todoId) });

            return { previousTodos };
        },
        // ONLY on error: rollback to previous state
        onError: (_err, _variables, context) => {
            if (context?.previousTodos) {
                queryClient.setQueryData(todosQueryKey, context.previousTodos);
            }
        },
        // onSuccess: intentionally empty - NEVER update UI from server response
        // onSettled: intentionally empty - NEVER refetch after mutation
    });
}
