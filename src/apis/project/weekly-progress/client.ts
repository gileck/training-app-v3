import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import {
    API_GET_WEEK_PROGRESS,
    API_UPDATE_SETS,
    API_GET_EXERCISE_NOTES,
    API_UPDATE_EXERCISE_NOTE,
} from './index';
import {
    GetWeekProgressRequest,
    GetWeekProgressResponse,
    UpdateSetsRequest,
    UpdateSetsResponse,
    GetExerciseNotesRequest,
    GetExerciseNotesResponse,
    UpdateExerciseNoteRequest,
    UpdateExerciseNoteResponse,
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
 * Get notes for a specific exercise (current week + previous weeks)
 */
export const getExerciseNotes = async (
    params: GetExerciseNotesRequest
): Promise<CacheResult<GetExerciseNotesResponse>> => {
    return apiClient.call(API_GET_EXERCISE_NOTES, params);
};

/**
 * Update note for a specific exercise in a specific week
 */
export const updateExerciseNote = async (
    params: UpdateExerciseNoteRequest
): Promise<CacheResult<UpdateExerciseNoteResponse>> => {
    return apiClient.post(API_UPDATE_EXERCISE_NOTE, params);
};


