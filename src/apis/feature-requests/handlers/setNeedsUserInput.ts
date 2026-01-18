import { API_SET_NEEDS_USER_INPUT } from '../index';
import { SetNeedsUserInputRequest, SetNeedsUserInputResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';

export const setNeedsUserInput = async (
    request: SetNeedsUserInputRequest,
    context: ApiHandlerContext
): Promise<SetNeedsUserInputResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        if (typeof request.needsUserInput !== 'boolean') {
            return { error: 'needsUserInput must be a boolean' };
        }

        const updated = await featureRequests.setNeedsUserInput(
            request.requestId,
            request.needsUserInput
        );

        if (!updated) {
            return { error: 'Feature request not found' };
        }

        return { featureRequest: toFeatureRequestClient(updated) };
    } catch (error: unknown) {
        console.error('Set needs user input error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to set needs user input' };
    }
};

export { API_SET_NEEDS_USER_INPUT };
