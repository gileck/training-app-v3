import type { ApiHandlerContext } from '@/apis/types';
import { sendPushToUser } from '@/server/template/push';
import type { SendTestRequest, SendTestResponse } from '../types';

export const sendTestHandler = async (
    request: SendTestRequest,
    context: ApiHandlerContext
): Promise<SendTestResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }

        const results = await sendPushToUser(context.userId, {
            title: request.title ?? 'Test notification',
            body: request.body ?? 'If you see this, push notifications are working.',
            url: request.url ?? '/',
            tag: 'test',
        });

        const sent = results.filter((r) => r.success).length;
        const removed = results.filter((r) => r.removed).length;

        return { success: true, sent, removed };
    } catch (error: unknown) {
        console.error('[push-notifications/sendTest] error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to send test push',
        };
    }
};
