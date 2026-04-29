import type { ApiHandlerContext } from '@/apis/types';
import { pushSubscriptions } from '@/server/database';
import type { UnsubscribeRequest, UnsubscribeResponse } from '../types';

export const unsubscribeHandler = async (
    request: UnsubscribeRequest,
    context: ApiHandlerContext
): Promise<UnsubscribeResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }
        if (!request?.endpoint) {
            return { error: 'endpoint is required' };
        }

        await pushSubscriptions.deleteSubscriptionByEndpointForUser(
            context.userId,
            request.endpoint
        );

        return { success: true };
    } catch (error: unknown) {
        console.error('[push-notifications/unsubscribe] error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to unsubscribe',
        };
    }
};
