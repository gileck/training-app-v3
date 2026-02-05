import { API_GET_FEATURE_REQUEST } from '../index';
import { GetFeatureRequestRequest, GetFeatureRequestResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';

export const getFeatureRequest = async (
    request: GetFeatureRequestRequest,
    context: ApiHandlerContext
): Promise<GetFeatureRequestResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        const featureRequest = await featureRequests.findFeatureRequestById(request.requestId);

        if (!featureRequest) {
            return { error: 'Feature request not found' };
        }

        return { featureRequest: toFeatureRequestClient(featureRequest) };
    } catch (error: unknown) {
        console.error('Get feature request error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get feature request' };
    }
};

export { API_GET_FEATURE_REQUEST };
