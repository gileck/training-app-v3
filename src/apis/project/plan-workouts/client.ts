import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_LIST_PLAN_WORKOUTS,
    API_CREATE_PLAN_WORKOUT,
    API_UPDATE_PLAN_WORKOUT,
    API_DELETE_PLAN_WORKOUT,
    API_REORDER_PLAN_WORKOUTS,
} from './index';
import {
    ListPlanWorkoutsRequest,
    ListPlanWorkoutsResponse,
    CreatePlanWorkoutRequest,
    CreatePlanWorkoutResponse,
    UpdatePlanWorkoutRequest,
    UpdatePlanWorkoutResponse,
    DeletePlanWorkoutRequest,
    DeletePlanWorkoutResponse,
    ReorderPlanWorkoutsRequest,
    ReorderPlanWorkoutsResponse,
} from './types';

/**
 * Get all plan workouts for a specific plan
 */
export const listPlanWorkouts = async (
    params: ListPlanWorkoutsRequest
): Promise<CacheResult<ListPlanWorkoutsResponse>> => {
    return apiClient.call(API_LIST_PLAN_WORKOUTS, params);
};

/**
 * Create a new plan workout
 */
export const createPlanWorkout = async (
    params: CreatePlanWorkoutRequest
): Promise<CacheResult<CreatePlanWorkoutResponse>> => {
    return apiClient.post(API_CREATE_PLAN_WORKOUT, params);
};

/**
 * Update a plan workout
 */
export const updatePlanWorkout = async (
    params: UpdatePlanWorkoutRequest
): Promise<CacheResult<UpdatePlanWorkoutResponse>> => {
    return apiClient.post(API_UPDATE_PLAN_WORKOUT, params);
};

/**
 * Delete a plan workout
 */
export const deletePlanWorkout = async (
    params: DeletePlanWorkoutRequest
): Promise<CacheResult<DeletePlanWorkoutResponse>> => {
    return apiClient.post(API_DELETE_PLAN_WORKOUT, params);
};

/**
 * Reorder plan workouts
 */
export const reorderPlanWorkouts = async (
    params: ReorderPlanWorkoutsRequest
): Promise<CacheResult<ReorderPlanWorkoutsResponse>> => {
    return apiClient.post(API_REORDER_PLAN_WORKOUTS, params);
};
