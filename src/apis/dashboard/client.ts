import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_GET_DASHBOARD_ANALYTICS } from './index';
import type {
    GetDashboardAnalyticsRequest,
    GetDashboardAnalyticsResponse,
} from './types';

/**
 * Get dashboard analytics data
 */
export const getDashboardAnalytics = async (
    params: GetDashboardAnalyticsRequest
): Promise<CacheResult<GetDashboardAnalyticsResponse>> => {
    return apiClient.call(API_GET_DASHBOARD_ANALYTICS, params);
};
