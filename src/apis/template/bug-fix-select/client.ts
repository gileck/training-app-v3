/**
 * Bug Fix Select API Client
 *
 * Client-side functions for calling the bug fix selection API.
 */

import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_INVESTIGATION, API_SUBMIT_FIX_SELECTION } from './index';
import type {
    GetInvestigationRequest,
    GetInvestigationResponse,
    SubmitFixSelectionRequest,
    SubmitFixSelectionResponse,
} from './types';

/**
 * Get investigation data for a bug issue.
 */
export const getInvestigation = async (
    params: GetInvestigationRequest
): Promise<CacheResult<GetInvestigationResponse>> => {
    return apiClient.call(API_GET_INVESTIGATION, params);
};

/**
 * Submit a fix selection for a bug.
 */
export const submitFixSelection = async (
    params: SubmitFixSelectionRequest
): Promise<CacheResult<SubmitFixSelectionResponse>> => {
    return apiClient.post(API_SUBMIT_FIX_SELECTION, params);
};
