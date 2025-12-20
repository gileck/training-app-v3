import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_LIST_SAVED_WORKOUTS,
    API_GET_SAVED_WORKOUT,
    API_CREATE_SAVED_WORKOUT,
    API_UPDATE_SAVED_WORKOUT,
    API_DELETE_SAVED_WORKOUT,
} from './index';
import {
    ListSavedWorkoutsRequest,
    ListSavedWorkoutsResponse,
    GetSavedWorkoutRequest,
    GetSavedWorkoutResponse,
    CreateSavedWorkoutRequest,
    CreateSavedWorkoutResponse,
    UpdateSavedWorkoutRequest,
    UpdateSavedWorkoutResponse,
    DeleteSavedWorkoutRequest,
    DeleteSavedWorkoutResponse,
} from './types';

/**
 * Get all saved workouts for the current user
 */
export const listSavedWorkouts = async (
    params: ListSavedWorkoutsRequest = {}
): Promise<CacheResult<ListSavedWorkoutsResponse>> => {
    return apiClient.call(API_LIST_SAVED_WORKOUTS, params);
};

/**
 * Get a single saved workout by ID
 */
export const getSavedWorkout = async (
    params: GetSavedWorkoutRequest
): Promise<CacheResult<GetSavedWorkoutResponse>> => {
    return apiClient.call(API_GET_SAVED_WORKOUT, params);
};

/**
 * Create a new saved workout
 */
export const createSavedWorkout = async (
    params: CreateSavedWorkoutRequest
): Promise<CacheResult<CreateSavedWorkoutResponse>> => {
    return apiClient.post(API_CREATE_SAVED_WORKOUT, params);
};

/**
 * Update a saved workout
 */
export const updateSavedWorkout = async (
    params: UpdateSavedWorkoutRequest
): Promise<CacheResult<UpdateSavedWorkoutResponse>> => {
    return apiClient.post(API_UPDATE_SAVED_WORKOUT, params);
};

/**
 * Delete a saved workout
 */
export const deleteSavedWorkout = async (
    params: DeleteSavedWorkoutRequest
): Promise<CacheResult<DeleteSavedWorkoutResponse>> => {
    return apiClient.post(API_DELETE_SAVED_WORKOUT, params);
};


