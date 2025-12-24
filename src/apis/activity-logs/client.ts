import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_GET_ACTIVITY,
    API_GET_ACTIVITY_SUMMARY,
    API_GET_EXERCISE_HISTORY,
    API_DELETE_ACTIVITY,
} from './index';
import type {
    GetActivityRequest,
    GetActivityResponse,
    GetActivitySummaryRequest,
    GetActivitySummaryResponse,
    GetExerciseHistoryRequest,
    GetExerciseHistoryResponse,
    DeleteActivityRequest,
    DeleteActivityResponse,
} from './types';

export async function getActivity(request: GetActivityRequest): Promise<CacheResult<GetActivityResponse>> {
    return apiClient.call(API_GET_ACTIVITY, request);
}

export async function getActivitySummary(
    request: GetActivitySummaryRequest
): Promise<CacheResult<GetActivitySummaryResponse>> {
    return apiClient.call(API_GET_ACTIVITY_SUMMARY, request);
}

export async function getExerciseHistory(
    request: GetExerciseHistoryRequest
): Promise<CacheResult<GetExerciseHistoryResponse>> {
    return apiClient.call(API_GET_EXERCISE_HISTORY, request);
}

export async function deleteActivity(
    request: DeleteActivityRequest
): Promise<CacheResult<DeleteActivityResponse>> {
    return apiClient.post(API_DELETE_ACTIVITY, request);
}
