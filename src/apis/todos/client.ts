import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_TODOS, API_GET_TODO, API_CREATE_TODO, API_UPDATE_TODO, API_DELETE_TODO } from './index';
import {
    GetTodosRequest,
    GetTodosResponse,
    GetTodoRequest,
    GetTodoResponse,
    CreateTodoRequest,
    CreateTodoResponse,
    UpdateTodoRequest,
    UpdateTodoResponse,
    DeleteTodoRequest,
    DeleteTodoResponse
} from './types';

/**
 * Get all todos for the current user
 */
export const getTodos = async (
    params: GetTodosRequest = {}
): Promise<CacheResult<GetTodosResponse>> => {
    return apiClient.call(API_GET_TODOS, params);
};

/**
 * Get a single todo by ID
 */
export const getTodo = async (
    params: GetTodoRequest
): Promise<CacheResult<GetTodoResponse>> => {
    return apiClient.call(API_GET_TODO, params);
};

/**
 * Create a new todo
 */
export const createTodo = async (
    params: CreateTodoRequest
): Promise<CacheResult<CreateTodoResponse>> => {
    return apiClient.post(API_CREATE_TODO, params);
};

/**
 * Update an existing todo
 */
export const updateTodo = async (
    params: UpdateTodoRequest
): Promise<CacheResult<UpdateTodoResponse>> => {
    return apiClient.post(API_UPDATE_TODO, params);
};

/**
 * Delete a todo
 */
export const deleteTodo = async (
    params: DeleteTodoRequest
): Promise<CacheResult<DeleteTodoResponse>> => {
    return apiClient.post(API_DELETE_TODO, params);
};
