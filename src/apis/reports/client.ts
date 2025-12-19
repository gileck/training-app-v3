import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { 
    API_CREATE_REPORT, 
    API_GET_REPORTS, 
    API_GET_REPORT, 
    API_UPDATE_REPORT_STATUS,
    API_DELETE_REPORT,
    API_DELETE_ALL_REPORTS
} from './index';
import {
    CreateReportRequest,
    CreateReportResponse,
    GetReportsRequest,
    GetReportsResponse,
    GetReportRequest,
    GetReportResponse,
    UpdateReportStatusRequest,
    UpdateReportStatusResponse,
    DeleteReportRequest,
    DeleteReportResponse,
    DeleteAllReportsRequest,
    DeleteAllReportsResponse,
} from './types';

/**
 * Create a new bug or error report
 */
export const createReport = async (
    params: CreateReportRequest
): Promise<CacheResult<CreateReportResponse>> => {
    return apiClient.post(API_CREATE_REPORT, params);
};

/**
 * Get all reports with optional filters
 * Note: Reports are excluded from React Query persistence in QueryProvider.tsx
 */
export const getReports = async (
    params: GetReportsRequest = {}
): Promise<CacheResult<GetReportsResponse>> => {
    return apiClient.call(API_GET_REPORTS, params);
};

/**
 * Get a single report by ID
 * Note: Reports are excluded from React Query persistence in QueryProvider.tsx
 */
export const getReport = async (
    params: GetReportRequest
): Promise<CacheResult<GetReportResponse>> => {
    return apiClient.call(API_GET_REPORT, params);
};

/**
 * Update a report's status
 */
export const updateReportStatus = async (
    params: UpdateReportStatusRequest
): Promise<CacheResult<UpdateReportStatusResponse>> => {
    return apiClient.post(API_UPDATE_REPORT_STATUS, params);
};

/**
 * Delete a single report
 */
export const deleteReport = async (
    params: DeleteReportRequest
): Promise<CacheResult<DeleteReportResponse>> => {
    return apiClient.post(API_DELETE_REPORT, params);
};

/**
 * Delete all reports
 */
export const deleteAllReports = async (
    params: DeleteAllReportsRequest = {}
): Promise<CacheResult<DeleteAllReportsResponse>> => {
    return apiClient.post(API_DELETE_ALL_REPORTS, params);
};
