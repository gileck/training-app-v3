import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_LIST_EXERCISES, API_GET_EXERCISE } from './index';
import {
    ListExercisesRequest,
    ListExercisesResponse,
    GetExerciseRequest,
    GetExerciseResponse,
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

