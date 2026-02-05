import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_LIST_EXERCISES,
    API_GET_EXERCISE,
    API_CREATE_EXERCISE,
    API_UPDATE_EXERCISE,
    API_DELETE_EXERCISE,
    API_GET_MUSCLE_GROUPS,
} from './index';
import {
    ListExercisesRequest,
    ListExercisesResponse,
    GetExerciseRequest,
    GetExerciseResponse,
    CreateExerciseRequest,
    CreateExerciseResponse,
    UpdateExerciseRequest,
    UpdateExerciseResponse,
    DeleteExerciseRequest,
    DeleteExerciseResponse,
    GetMuscleGroupsRequest,
    GetMuscleGroupsResponse,
} from './types';

/**
 * Get all exercises available to the current user (system + custom)
 */
export const listExercises = async (
    params: ListExercisesRequest = {}
): Promise<CacheResult<ListExercisesResponse>> => {
    return apiClient.call(API_LIST_EXERCISES, params);
};

/**
 * Get a single exercise by ID
 */
export const getExercise = async (
    params: GetExerciseRequest
): Promise<CacheResult<GetExerciseResponse>> => {
    return apiClient.call(API_GET_EXERCISE, params);
};

/**
 * Create a custom exercise
 */
export const createExercise = async (
    params: CreateExerciseRequest
): Promise<CacheResult<CreateExerciseResponse>> => {
    return apiClient.post(API_CREATE_EXERCISE, params);
};

/**
 * Update a custom exercise
 */
export const updateExercise = async (
    params: UpdateExerciseRequest
): Promise<CacheResult<UpdateExerciseResponse>> => {
    return apiClient.post(API_UPDATE_EXERCISE, params);
};

/**
 * Delete a custom exercise
 */
export const deleteExercise = async (
    params: DeleteExerciseRequest
): Promise<CacheResult<DeleteExerciseResponse>> => {
    return apiClient.post(API_DELETE_EXERCISE, params);
};

/**
 * Get all unique muscle groups from exercise library
 */
export const getMuscleGroups = async (
    params: GetMuscleGroupsRequest = {}
): Promise<CacheResult<GetMuscleGroupsResponse>> => {
    return apiClient.call(API_GET_MUSCLE_GROUPS, params);
};

