import { API_GET_FEATURE_REQUESTS } from '../index';
import { GetFeatureRequestsRequest, GetFeatureRequestsResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';
import { FeatureRequestFilters } from '@/server/database/collections/feature-requests/types';

export const getFeatureRequests = async (
    request: GetFeatureRequestsRequest,
    context: ApiHandlerContext
): Promise<GetFeatureRequestsResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        const filters: FeatureRequestFilters = {};

        if (request.status) {
            filters.status = request.status;
        }

        if (request.priority) {
            filters.priority = request.priority;
        }

        if (request.startDate) {
            filters.startDate = new Date(request.startDate);
        }

        if (request.endDate) {
            filters.endDate = new Date(request.endDate);
        }

        const sortBy = request.sortBy || 'createdAt';
        const sortOrder = request.sortOrder || 'desc';

        const requests = await featureRequests.findFeatureRequests(filters, sortBy, sortOrder);

        return {
            featureRequests: requests.map(toFeatureRequestClient),
        };
    } catch (error: unknown) {
        console.error('Get feature requests error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get feature requests' };
    }
};

export { API_GET_FEATURE_REQUESTS };
