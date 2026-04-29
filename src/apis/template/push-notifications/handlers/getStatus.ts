import type { ApiHandlerContext } from '@/apis/types';
import { pushSubscriptions } from '@/server/database';
import { isPushConfigured } from '@/server/template/push';
import type { GetStatusRequest, GetStatusResponse } from '../types';

export const getStatusHandler = async (
    _request: GetStatusRequest,
    context: ApiHandlerContext
): Promise<GetStatusResponse> => {
    try {
        const configured = isPushConfigured();
        if (!context.userId) {
            return { subscribed: false, endpoints: 0, configured };
        }

        const count = await pushSubscriptions.countSubscriptionsByUser(context.userId);
        return { subscribed: count > 0, endpoints: count, configured };
    } catch (error: unknown) {
        console.error('[push-notifications/status] error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to get status',
        };
    }
};
