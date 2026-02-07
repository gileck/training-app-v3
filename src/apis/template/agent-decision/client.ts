/**
 * Agent Decision API Client
 *
 * Client-side functions for calling the agent decision API.
 */

import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_DECISION, API_SUBMIT_DECISION } from './index';
import type {
    GetDecisionRequest,
    GetDecisionResponse,
    SubmitDecisionRequest,
    SubmitDecisionResponse,
} from './types';

/**
 * Get decision data for an issue.
 */
export const getDecision = async (
    params: GetDecisionRequest
): Promise<CacheResult<GetDecisionResponse>> => {
    return apiClient.call(API_GET_DECISION, params);
};

/**
 * Submit a decision selection.
 */
export const submitDecision = async (
    params: SubmitDecisionRequest
): Promise<CacheResult<SubmitDecisionResponse>> => {
    return apiClient.post(API_SUBMIT_DECISION, params);
};
