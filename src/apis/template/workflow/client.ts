import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_LIST_WORKFLOW_ITEMS, API_UPDATE_WORKFLOW_STATUS } from './index';
import type {
    ListWorkflowItemsRequest,
    ListWorkflowItemsResponse,
    UpdateWorkflowStatusRequest,
    UpdateWorkflowStatusResponse,
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
