import { API_UPDATE_PRIORITY } from '../index';
import { UpdatePriorityRequest, UpdatePriorityResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';

export const updatePriority = async (
    request: UpdatePriorityRequest,
    context: ApiHandlerContext
): Promise<UpdatePriorityResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        if (!request.priority) {
            return { error: 'Priority is required' };
        }

        const updated = await featureRequests.updatePriority(
            request.requestId,
            request.priority
        );

        if (!updated) {
            return { error: 'Feature request not found' };
        }

        return { featureRequest: toFeatureRequestClient(updated) };
    } catch (error: unknown) {
        console.error('Update priority error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update priority' };
    }
};

export { API_UPDATE_PRIORITY };
