import type { ApiHandlerContext } from '@/apis/types';
import { sendPushToUser } from '@/server/template/push';
import type { SendTestToUserRequest, SendTestToUserResponse } from '../types';

export const sendTestToUserHandler = async (
    request: SendTestToUserRequest,
    context: ApiHandlerContext
): Promise<SendTestToUserResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }
        if (!request?.userId) {
            return { error: 'userId is required' };
        }

        const results = await sendPushToUser(request.userId, {
            title: request.title ?? 'Test notification',
            body: request.body ?? 'Sent from admin panel.',
            url: request.url ?? '/',
            tag: 'admin-test',
        });

        const sent = results.filter((r) => r.success).length;
        const removed = results.filter((r) => r.removed).length;

        return { success: true, sent, removed };
    } catch (error: unknown) {
        console.error('[admin/push-notifications/sendTest] error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to send test push',
        };
    }
};
