import apiClient from '@/client/utils/apiClient';
import { CacheResult } from '@/common/cache/types';
import { API_LIST_WORKFLOW_ITEMS } from './index';
import type {
    ListWorkflowItemsRequest,
    ListWorkflowItemsResponse,
} from './types';

/**
 * List all workflow items with their statuses
 */
export const listWorkflowItems = async (
    params?: ListWorkflowItemsRequest
): Promise<CacheResult<ListWorkflowItemsResponse>> => {
    return apiClient.call(API_LIST_WORKFLOW_ITEMS, params || {});
};
