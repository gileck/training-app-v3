import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_CLARIFICATION, API_SUBMIT_ANSWER } from './index';
import type {
    GetClarificationRequest,
    GetClarificationResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
} from './types';

/**
 * Get clarification data for an issue
 */
export const getClarification = async (
    params: GetClarificationRequest
): Promise<CacheResult<GetClarificationResponse>> => {
    return apiClient.call(API_GET_CLARIFICATION, params);
};

/**
 * Submit answers to a clarification request
 */
export const submitAnswer = async (
    params: SubmitAnswerRequest
): Promise<CacheResult<SubmitAnswerResponse>> => {
    return apiClient.post(API_SUBMIT_ANSWER, params);
};
