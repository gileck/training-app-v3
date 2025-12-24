import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_GET_WEEK_PROGRESS,
    API_UPDATE_SETS,
    API_GET_WEEKLY_NOTE,
    API_UPDATE_WEEKLY_NOTE,
} from './index';
import {
    GetWeekProgressRequest,
    GetWeekProgressResponse,
    UpdateSetsRequest,
    UpdateSetsResponse,
    GetWeeklyNoteRequest,
    GetWeeklyNoteResponse,
    UpdateWeeklyNoteRequest,
    UpdateWeeklyNoteResponse,
} from './types';

/**
 * Get progress for a specific week in a training plan
 */
export const getWeekProgress = async (
    params: GetWeekProgressRequest
): Promise<CacheResult<GetWeekProgressResponse>> => {
    return apiClient.call(API_GET_WEEK_PROGRESS, params);
};

/**
 * Add or remove a set completion
 */
export const updateSets = async (
    params: UpdateSetsRequest
): Promise<CacheResult<UpdateSetsResponse>> => {
    return apiClient.post(API_UPDATE_SETS, params);
};

/**
 * Get weekly note for a specific week
 */
export const getWeeklyNote = async (
    params: GetWeeklyNoteRequest
): Promise<CacheResult<GetWeeklyNoteResponse>> => {
    return apiClient.call(API_GET_WEEKLY_NOTE, params);
};

/**
 * Update weekly note for a specific week
 */
export const updateWeeklyNote = async (
    params: UpdateWeeklyNoteRequest
): Promise<CacheResult<UpdateWeeklyNoteResponse>> => {
    return apiClient.post(API_UPDATE_WEEKLY_NOTE, params);
};


