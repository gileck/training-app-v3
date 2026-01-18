import { API_UPDATE_DESIGN_CONTENT } from '../index';
import { UpdateDesignContentRequest, UpdateDesignContentResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';

export const updateDesignContent = async (
    request: UpdateDesignContentRequest,
    context: ApiHandlerContext
): Promise<UpdateDesignContentResponse> => {
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

        if (!request.content) {
            return { error: 'Content is required' };
        }

        const updated = await featureRequests.updateDesignContent(
            request.requestId,
            request.phase,
            request.content,
            request.reviewStatus
        );

        if (!updated) {
            return { error: 'Feature request not found' };
        }

        return { featureRequest: toFeatureRequestClient(updated) };
    } catch (error: unknown) {
        console.error('Update design content error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update design content' };
    }
};

export { API_UPDATE_DESIGN_CONTENT };
