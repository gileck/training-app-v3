import React, { useState, useEffect } from 'react';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { Alert } from '@/client/components/ui/alert';
import { LinearProgress } from '@/client/components/ui/linear-progress';
import { Card } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/client/components/ui/dialog';
import { CheckSquare, Eye, Plus, RefreshCcw, Save, X, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from '../../router';
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from './hooks';
import type { TodoItemClient } from '@/server/database/collections/todos/types';
import { logger } from '@/client/features/session-logs';

/**
 * Todos page component using React Query
 * 
 * Benefits:
 * - Instant load from IndexedDB cache on app restart
 * - Background revalidation for fresh data
 * - Optimistic updates via mutations
 */
export function Todos() {
    const { navigate } = useRouter();

    // React Query hooks - cache is guaranteed to be restored at this point
    // (handled globally by QueryProvider's WaitForCacheRestore)
    const { data, isLoading, isFetching, error, refetch } = useTodos();
    const createTodoMutation = useCreateTodo();
    const updateTodoMutation = useUpdateTodo();
    const deleteTodoMutation = useDeleteTodo();

    // Local UI state - ephemeral form/dialog state that doesn't need persistence
    // eslint-disable-next-line state-management/prefer-state-architecture -- form input before submission
    const [newTodoTitle, setNewTodoTitle] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- local error display cleared on next action
    const [actionError, setActionError] = useState<string>('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral inline edit state
    const [editingTodo, setEditingTodo] = useState<TodoItemClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral inline edit state
    const [editTitle, setEditTitle] = useState('');
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog context
    const [todoToDelete, setTodoToDelete] = useState<TodoItemClient | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- track which todo is being mutated
    const [mutatingTodoId, setMutatingTodoId] = useState<string | null>(null);

    const todos = data?.todos || [];
    const isCreating = createTodoMutation.isPending;

    // Log page view on mount
    useEffect(() => {
        logger.info('todos', 'Todos page viewed', { 
            meta: { todoCount: todos.length } 
        });
    }, []);

    // Show loading only if fetching with no cached data
    // Cache restoration is handled globally by QueryProvider
    if (isLoading && !data) {
        return (
            <div className="w-full py-4">
                <LinearProgress />
                <p className="mt-2 text-center text-sm text-muted-foreground">Loading your todos...</p>
            </div>
        );
    }

    const handleCreateTodo = async () => {
        if (!newTodoTitle.trim()) {
            logger.warn('todos', 'Create todo attempted with empty title');
            setActionError('Please enter a todo title');
            return;
        }

        const title = newTodoTitle.trim();
        logger.info('todos', 'Creating new todo', { meta: { title } });
        
        setActionError('');
        setNewTodoTitle('');

        createTodoMutation.mutate(
            { title },
            {
                onSuccess: () => {
                    logger.info('todos', 'Todo created successfully', { meta: { title } });
                },
                onError: (err) => {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to create todo';
                    logger.error('todos', 'Failed to create todo', { meta: { title, error: errorMessage } });
                    setActionError(errorMessage);
                },
            }
        );
    };

    const handleToggleComplete = async (todo: TodoItemClient) => {
        const newCompletedState = !todo.completed;
        logger.info('todos', `Toggling todo completion`, { 
            meta: { todoId: todo._id, title: todo.title, completed: newCompletedState } 
        });
        
        setActionError('');
        setMutatingTodoId(todo._id);

        updateTodoMutation.mutate(
            { todoId: todo._id, completed: newCompletedState },
            {
                onSettled: () => setMutatingTodoId(null),
                onSuccess: () => {
                    logger.info('todos', `Todo marked as ${newCompletedState ? 'completed' : 'incomplete'}`, { 
                        meta: { todoId: todo._id, title: todo.title } 
                    });
                },
                onError: (err) => {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to update todo';
                    logger.error('todos', 'Failed to toggle todo completion', { 
                        meta: { todoId: todo._id, error: errorMessage } 
                    });
                    setActionError(errorMessage);
                },
            }
        );
    };

    const handleStartEdit = (todo: TodoItemClient) => {
        logger.info('todos', 'Started editing todo', { 
            meta: { todoId: todo._id, title: todo.title } 
        });
        setEditingTodo(todo);
        setEditTitle(todo.title);
    };

    const handleSaveEdit = async () => {
        if (!editingTodo || !editTitle.trim()) {
            logger.warn('todos', 'Save edit attempted with empty title');
            setActionError('Please enter a valid title');
            return;
        }

        const todoId = editingTodo._id;
        const oldTitle = editingTodo.title;
        const newTitle = editTitle.trim();
        
        logger.info('todos', 'Saving todo edit', { 
            meta: { todoId, oldTitle, newTitle } 
        });

        setActionError('');
        setMutatingTodoId(todoId);
        setEditingTodo(null);
        setEditTitle('');

        updateTodoMutation.mutate(
            { todoId, title: newTitle },
            {
                onSettled: () => setMutatingTodoId(null),
                onSuccess: () => {
                    logger.info('todos', 'Todo title updated', { 
                        meta: { todoId, oldTitle, newTitle } 
                    });
                },
                onError: (err) => {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to update todo';
                    logger.error('todos', 'Failed to update todo title', { 
                        meta: { todoId, error: errorMessage } 
                    });
                    setActionError(errorMessage);
                },
            }
        );
    };

    const handleCancelEdit = () => {
        if (editingTodo) {
            logger.info('todos', 'Cancelled editing todo', { 
                meta: { todoId: editingTodo._id } 
            });
        }
        setEditingTodo(null);
        setEditTitle('');
    };

    const handleDeleteTodo = async (todo: TodoItemClient) => {
        logger.info('todos', 'Delete confirmation opened', { 
            meta: { todoId: todo._id, title: todo.title } 
        });
        setTodoToDelete(todo);
        setDeleteConfirmOpen(true);
    };

    const handleViewTodo = (todo: TodoItemClient) => {
        logger.info('todos', 'Navigating to todo detail', { 
            meta: { todoId: todo._id, title: todo.title } 
        });
        navigate(`/todos/${todo._id}`);
    };

    const confirmDelete = async () => {
        if (!todoToDelete) return;

        const todoId = todoToDelete._id;
        const title = todoToDelete.title;
        
        logger.info('todos', 'Deleting todo', { meta: { todoId, title } });

        setActionError('');
        setMutatingTodoId(todoId);
        setDeleteConfirmOpen(false);
        setTodoToDelete(null);

        deleteTodoMutation.mutate(
            { todoId },
            {
                onSettled: () => setMutatingTodoId(null),
                onSuccess: () => {
                    logger.info('todos', 'Todo deleted successfully', { meta: { todoId, title } });
                },
                onError: (err) => {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to delete todo';
                    logger.error('todos', 'Failed to delete todo', { 
                        meta: { todoId, error: errorMessage } 
                    });
                    setActionError(errorMessage);
                },
            }
        );
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCreateTodo();
        }
    };

    const handleEditKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    const handleRefresh = () => {
        logger.info('todos', 'Manual refresh triggered', { meta: { currentCount: todos.length } });
        refetch();
    };

    const handleCancelDelete = () => {
        if (todoToDelete) {
            logger.info('todos', 'Delete cancelled', { 
                meta: { todoId: todoToDelete._id, title: todoToDelete.title } 
            });
        }
        setDeleteConfirmOpen(false);
    };

    const displayError = (error instanceof Error ? error.message : null) || actionError;

    return (
        <div className="mx-auto max-w-3xl p-3">
            <div className="mb-3 flex items-center justify-between">
                <h1 className="text-2xl font-semibold">My Todos</h1>
                <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
                </Button>
            </div>

            {displayError && (
                <Alert variant="destructive" className="mb-2">{displayError}</Alert>
            )}

            {/* Add new todo */}
            <Card className="mb-3 p-2">
                <div className="flex items-center gap-2">
                    <Input
                        value={newTodoTitle}
                        onChange={(e) => setNewTodoTitle(e.target.value)}
                        placeholder="Enter a new todo..."
                        onKeyPress={handleKeyPress}
                        disabled={isCreating}
                    />
                    <Button onClick={handleCreateTodo} disabled={isCreating || !newTodoTitle.trim()}>
                        <Plus className="mr-2 h-4 w-4" /> Add
                    </Button>
                    {createTodoMutation.isPending && <div className="w-24"><LinearProgress className="mt-1" /></div>}
                </div>
            </Card>

            {/* Todos list */}
            <Card className="p-2">
                {todos.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No todos yet. Add one above!</p>
                ) : (
                    <ul>
                        {todos.map((todo, index) => (
                            <React.Fragment key={todo._id}>
                                <li
                                    className={`mb-1 flex items-center gap-2 rounded p-2 ${todo.completed ? 'opacity-70 bg-accent' : ''}`}
                                >
                                    <button
                                        className="h-5 w-5 rounded border"
                                        aria-checked={todo.completed}
                                        role="checkbox"
                                        onClick={() => handleToggleComplete(todo)}
                                        disabled={mutatingTodoId === todo._id}
                                    >
                                        {todo.completed ? <CheckSquare className="h-4 w-4" /> : null}
                                    </button>

                                    {editingTodo?._id === todo._id ? (
                                        <Input
                                            className="flex-1"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onKeyPress={handleEditKeyPress}
                                            disabled={mutatingTodoId === todo._id}
                                            autoFocus
                                        />
                                    ) : (
                                        <span className={`flex-1 ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                                            {todo.title}
                                        </span>
                                    )}

                                    {editingTodo?._id === todo._id ? (
                                        <div className="flex gap-1">
                                            <Button variant="secondary" size="sm" onClick={handleSaveEdit} disabled={mutatingTodoId === todo._id}>
                                                <Save className="mr-1 h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                                                <X className="mr-1 h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => handleViewTodo(todo)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleStartEdit(todo)} disabled={mutatingTodoId === todo._id}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteTodo(todo)} disabled={mutatingTodoId === todo._id}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    )}
                                </li>
                                {index < todos.length - 1 && <Separator />}
                            </React.Fragment>
                        ))}
                    </ul>
                )}
            </Card>

            {/* Delete confirmation dialog */}
            <Dialog open={deleteConfirmOpen} onOpenChange={(open) => !open && handleCancelDelete()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Todo</DialogTitle>
                    </DialogHeader>
                    <p>Are you sure you want to delete &quot;{todoToDelete?.title}&quot;?</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancelDelete}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete} autoFocus>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

