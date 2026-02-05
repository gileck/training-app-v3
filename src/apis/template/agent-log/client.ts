import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_AGENT_LOG_EVENT, API_AGENT_LOG_PHASE } from './index';
import type {
    LogEventRequest,
    LogEventResponse,
    LogPhaseRequest,
    LogPhaseResponse,
} from './types';

/**
 * Log an external event to an agent log file
 */
export const logAgentEvent = async (
    params: LogEventRequest
): Promise<CacheResult<LogEventResponse>> => {
    return apiClient.post(API_AGENT_LOG_EVENT, params);
};

/**
 * Log a phase start/end to an agent log file
 */
export const logAgentPhase = async (
    params: LogPhaseRequest
): Promise<CacheResult<LogPhaseResponse>> => {
    return apiClient.post(API_AGENT_LOG_PHASE, params);
};
