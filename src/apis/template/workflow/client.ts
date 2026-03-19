import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_LIST_WORKFLOW_ITEMS, API_UPDATE_WORKFLOW_STATUS, API_WORKFLOW_ACTION, API_UPDATE_WORKFLOW_FIELDS } from './index';
import type {
    ListWorkflowItemsRequest,
    ListWorkflowItemsResponse,
    UpdateWorkflowStatusRequest,
    UpdateWorkflowStatusResponse,
    WorkflowActionRequest,
    WorkflowActionResponse,
    UpdateWorkflowFieldsRequest,
    UpdateWorkflowFieldsResponse,
} from './types';

/**
 * List all workflow items with their statuses
 */
export const listWorkflowItems = async (
    params?: ListWorkflowItemsRequest
): Promise<CacheResult<ListWorkflowItemsResponse>> => {
    return apiClient.call(API_LIST_WORKFLOW_ITEMS, params || {});
};

/**
 * Update the status of a workflow item
 */
export const updateWorkflowStatus = async (
    params: UpdateWorkflowStatusRequest
): Promise<CacheResult<UpdateWorkflowStatusResponse>> => {
    return apiClient.call(API_UPDATE_WORKFLOW_STATUS, params);
};

/**
 * Execute a workflow action (review, request changes, mark done, etc.)
 */
export const executeWorkflowAction = async (
    params: WorkflowActionRequest
): Promise<CacheResult<WorkflowActionResponse>> => {
    return apiClient.call(API_WORKFLOW_ACTION, params);
};

/**
 * Update priority, size, and complexity fields on a workflow item
 */
export const updateWorkflowFields = async (
    params: UpdateWorkflowFieldsRequest
): Promise<CacheResult<UpdateWorkflowFieldsResponse>> => {
    return apiClient.call(API_UPDATE_WORKFLOW_FIELDS, params);
};
