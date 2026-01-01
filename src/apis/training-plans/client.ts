import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_LIST_PLANS,
    API_GET_PLAN,
    API_CREATE_PLAN,
    API_UPDATE_PLAN,
    API_DELETE_PLAN,
    API_SET_ACTIVE_PLAN,
    API_DUPLICATE_PLAN,
    API_GENERATE_PLAN_FROM_TEXT,
    API_CREATE_PLAN_FROM_TEXT,
} from './index';
import {
    ListPlansRequest,
    ListPlansResponse,
    GetPlanRequest,
    GetPlanResponse,
    CreatePlanRequest,
    CreatePlanResponse,
    UpdatePlanRequest,
    UpdatePlanResponse,
    DeletePlanRequest,
    DeletePlanResponse,
    SetActivePlanRequest,
    SetActivePlanResponse,
    DuplicatePlanRequest,
    DuplicatePlanResponse,
    GeneratePlanFromTextRequest,
    GeneratePlanFromTextResponse,
    CreatePlanFromTextRequest,
    CreatePlanFromTextResponse,
} from './types';

/**
 * Get all training plans for the current user
 */
export const listPlans = async (
    params: ListPlansRequest = {}
): Promise<CacheResult<ListPlansResponse>> => {
    return apiClient.call(API_LIST_PLANS, params);
};

/**
 * Get a single training plan by ID
 */
export const getPlan = async (
    params: GetPlanRequest
): Promise<CacheResult<GetPlanResponse>> => {
    return apiClient.call(API_GET_PLAN, params);
};

/**
 * Create a new training plan
 */
export const createPlan = async (
    params: CreatePlanRequest
): Promise<CacheResult<CreatePlanResponse>> => {
    return apiClient.post(API_CREATE_PLAN, params);
};

/**
 * Update a training plan
 */
export const updatePlan = async (
    params: UpdatePlanRequest
): Promise<CacheResult<UpdatePlanResponse>> => {
    return apiClient.post(API_UPDATE_PLAN, params);
};

/**
 * Duplicate a training plan
 */
export const duplicatePlan = async (
    params: DuplicatePlanRequest
): Promise<CacheResult<DuplicatePlanResponse>> => {
    return apiClient.post(API_DUPLICATE_PLAN, params);
};

/**
 * Delete a training plan
 */
export const deletePlan = async (
    params: DeletePlanRequest
): Promise<CacheResult<DeletePlanResponse>> => {
    return apiClient.post(API_DELETE_PLAN, params);
};

/**
 * Set a training plan as active
 */
export const setActivePlan = async (
    params: SetActivePlanRequest
): Promise<CacheResult<SetActivePlanResponse>> => {
    return apiClient.post(API_SET_ACTIVE_PLAN, params);
};

/**
 * Generate a training plan preview from free-form text using AI
 */
export const generatePlanFromText = async (
    params: GeneratePlanFromTextRequest
): Promise<CacheResult<GeneratePlanFromTextResponse>> => {
    return apiClient.post(API_GENERATE_PLAN_FROM_TEXT, params);
};

/**
 * Create a training plan from a previewed draft (commits the plan)
 */
export const createPlanFromText = async (
    params: CreatePlanFromTextRequest
): Promise<CacheResult<CreatePlanFromTextResponse>> => {
    return apiClient.post(API_CREATE_PLAN_FROM_TEXT, params);
};


