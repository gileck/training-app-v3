import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_WEEK_PROGRESS, API_UPDATE_SETS } from './index';
import {
    GetWeekProgressRequest,
    GetWeekProgressResponse,
    UpdateSetsRequest,
    UpdateSetsResponse,
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

