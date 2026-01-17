import { GenerateWarmupRequest, GenerateWarmupResponse } from './types';
import apiClient from '@/client/utils/apiClient';
import { GENERATE_WARMUP } from './index';
import type { CacheResult } from '@/common/cache/types';

export { type GenerateWarmupRequest, type GenerateWarmupResponse };

/**
 * Generate a personalized workout warmup based on exercises
 * @param request The exercises to generate warmup for
 * @returns Promise with the generated warmup markdown
 */
export const generateWarmup = (request: GenerateWarmupRequest): Promise<CacheResult<GenerateWarmupResponse>> => {
    return apiClient.call<GenerateWarmupResponse, GenerateWarmupRequest>(GENERATE_WARMUP, request);
};
