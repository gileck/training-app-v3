import type { ApiHandlerContext } from '@/apis/types';
import { pushSubscriptions } from '@/server/database';
import type { SubscribeRequest, SubscribeResponse } from '../types';

const ALLOWED_PLATFORMS = ['ios', 'android', 'desktop', 'unknown'] as const;

export const subscribeHandler = async (
    request: SubscribeRequest,
    context: ApiHandlerContext
): Promise<SubscribeResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }
        if (!request?.endpoint || !request.keys?.p256dh || !request.keys?.auth) {
            return { error: 'Invalid subscription payload' };
        }

        const platform = ALLOWED_PLATFORMS.includes(request.platform)
            ? request.platform
            : 'unknown';

        await pushSubscriptions.upsertSubscription(context.userId, {
            endpoint: request.endpoint,
            keys: { p256dh: request.keys.p256dh, auth: request.keys.auth },
            platform,
            userAgent: request.userAgent,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('[push-notifications/subscribe] error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to subscribe',
        };
    }
};
