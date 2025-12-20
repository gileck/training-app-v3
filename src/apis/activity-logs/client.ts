import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_ACTIVITY, API_GET_ACTIVITY_SUMMARY } from './index';
import type {
    GetActivityRequest,
    GetActivityResponse,
    GetActivitySummaryRequest,
    GetActivitySummaryResponse,
} from './types';

export async function getActivity(request: GetActivityRequest): Promise<CacheResult<GetActivityResponse>> {
    return apiClient.call(API_GET_ACTIVITY, request);
}

export async function getActivitySummary(
    request: GetActivitySummaryRequest
): Promise<CacheResult<GetActivitySummaryResponse>> {
    return apiClient.call(API_GET_ACTIVITY_SUMMARY, request);
}
