import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_GET_ACTIVITY,
    API_GET_ACTIVITY_SUMMARY,
    API_GET_EXERCISE_HISTORY,
    API_DELETE_ACTIVITY,
    API_BULK_DELETE_ACTIVITY,
    API_EDIT_ACTIVITY,
    API_DUPLICATE_ACTIVITY,
    API_ADD_ACTIVITY,
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
    BulkDeleteActivityRequest,
    BulkDeleteActivityResponse,
    EditActivityRequest,
    EditActivityResponse,
    DuplicateActivityRequest,
    DuplicateActivityResponse,
    AddActivityRequest,
    AddActivityResponse,
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

export async function bulkDeleteActivity(
    request: BulkDeleteActivityRequest
): Promise<CacheResult<BulkDeleteActivityResponse>> {
    return apiClient.post(API_BULK_DELETE_ACTIVITY, request);
}

export async function editActivity(
    request: EditActivityRequest
): Promise<CacheResult<EditActivityResponse>> {
    return apiClient.post(API_EDIT_ACTIVITY, request);
}

export async function duplicateActivity(
    request: DuplicateActivityRequest
): Promise<CacheResult<DuplicateActivityResponse>> {
    return apiClient.post(API_DUPLICATE_ACTIVITY, request);
}

export async function addActivity(
    request: AddActivityRequest
): Promise<CacheResult<AddActivityResponse>> {
    return apiClient.post(API_ADD_ACTIVITY, request);
}
