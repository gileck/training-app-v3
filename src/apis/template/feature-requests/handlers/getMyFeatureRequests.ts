import { API_GET_MY_FEATURE_REQUESTS } from '../index';
import { GetMyFeatureRequestsRequest, GetMyFeatureRequestsResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClientForUser } from './utils';

export const getMyFeatureRequests = async (
    _request: GetMyFeatureRequestsRequest,
    context: ApiHandlerContext
): Promise<GetMyFeatureRequestsResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }

        const requests = await featureRequests.findFeatureRequestsByUser(context.userId);

        return {
            featureRequests: requests.map(toFeatureRequestClientForUser),
        };
    } catch (error: unknown) {
        console.error('Get my feature requests error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get feature requests' };
    }
};

export { API_GET_MY_FEATURE_REQUESTS };
