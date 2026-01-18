import { API_UPDATE_DESIGN_REVIEW_STATUS } from '../index';
import { UpdateDesignReviewStatusRequest, UpdateDesignReviewStatusResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';

export const updateDesignReviewStatus = async (
    request: UpdateDesignReviewStatusRequest,
    context: ApiHandlerContext
): Promise<UpdateDesignReviewStatusResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        if (!request.phase || !['product', 'tech'].includes(request.phase)) {
            return { error: 'Valid phase (product or tech) is required' };
        }

        if (!request.reviewStatus) {
            return { error: 'Review status is required' };
        }

        const updated = await featureRequests.setDesignReviewStatus(
            request.requestId,
            request.phase,
            request.reviewStatus,
            request.adminComments
        );

        if (!updated) {
            return { error: 'Feature request not found or design phase not initialized' };
        }

        return { featureRequest: toFeatureRequestClient(updated) };
    } catch (error: unknown) {
        console.error('Update design review status error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update design review status' };
    }
};

export { API_UPDATE_DESIGN_REVIEW_STATUS };
