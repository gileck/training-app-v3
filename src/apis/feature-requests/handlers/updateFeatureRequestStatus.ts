import { API_UPDATE_FEATURE_REQUEST_STATUS } from '../index';
import { UpdateFeatureRequestStatusRequest, UpdateFeatureRequestStatusResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';

export const updateFeatureRequestStatus = async (
    request: UpdateFeatureRequestStatusRequest,
    context: ApiHandlerContext
): Promise<UpdateFeatureRequestStatusResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        if (!request.status) {
            return { error: 'Status is required' };
        }

        const updated = await featureRequests.updateFeatureRequestStatus(
            request.requestId,
            request.status
        );

        if (!updated) {
            return { error: 'Feature request not found' };
        }

        return { featureRequest: toFeatureRequestClient(updated) };
    } catch (error: unknown) {
        console.error('Update feature request status error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update status' };
    }
};

export { API_UPDATE_FEATURE_REQUEST_STATUS };
