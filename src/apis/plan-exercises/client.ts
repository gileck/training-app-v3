import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_LIST_PLAN_EXERCISES,
    API_ADD_PLAN_EXERCISE,
    API_UPDATE_PLAN_EXERCISE,
    API_DELETE_PLAN_EXERCISE,
} from './index';
import {
    ListPlanExercisesRequest,
    ListPlanExercisesResponse,
    AddPlanExerciseRequest,
    AddPlanExerciseResponse,
    UpdatePlanExerciseRequest,
    UpdatePlanExerciseResponse,
    DeletePlanExerciseRequest,
    DeletePlanExerciseResponse,
} from './types';

/**
 * Get all exercises in a training plan
 */
export const listPlanExercises = async (
    params: ListPlanExercisesRequest
): Promise<CacheResult<ListPlanExercisesResponse>> => {
    return apiClient.call(API_LIST_PLAN_EXERCISES, params);
};

/**
 * Add an exercise to a training plan
 */
export const addPlanExercise = async (
    params: AddPlanExerciseRequest
): Promise<CacheResult<AddPlanExerciseResponse>> => {
    return apiClient.post(API_ADD_PLAN_EXERCISE, params);
};

/**
 * Update an exercise in a training plan
 */
export const updatePlanExercise = async (
    params: UpdatePlanExerciseRequest
): Promise<CacheResult<UpdatePlanExerciseResponse>> => {
    return apiClient.post(API_UPDATE_PLAN_EXERCISE, params);
};

/**
 * Remove an exercise from a training plan
 */
export const deletePlanExercise = async (
    params: DeletePlanExerciseRequest
): Promise<CacheResult<DeletePlanExerciseResponse>> => {
    return apiClient.post(API_DELETE_PLAN_EXERCISE, params);
};

