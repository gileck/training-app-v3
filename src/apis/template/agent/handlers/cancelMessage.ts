/**
 * Cancel a pending assistant message.
 *
 * The daemon side has no real abort signal — the agent SDK keeps
 * running until completion or timeout. What we can do is flip the
 * assistant row to 'errored' immediately so the UI unblocks. The
 * adapter's `finalizeAssistantMessage` is now guarded by a
 * `status: 'pending'` filter, so a late-arriving daemon finalize on a
 * cancelled row is a no-op (the cancellation wins).
 */

import type { ObjectId } from 'mongodb';
import {
    cancelPendingMessage,
    findMessageById,
} from '@/server/database/collections/template/agentConversations';
import { cancelQuestionsForMessage } from '@/server/database/collections/template/agentQuestions/agentQuestions';
import {
    appendTrace,
    finishTrace,
} from '@/server/database/collections/template/agentTraces/agentTraces';
import { toQueryId } from '@/server/template/utils';
import type { ApiHandlerContext } from '@/apis/types';
import type {
    CancelMessageRequest,
    CancelMessageResponse,
} from '../types';

export const cancelMessage = async (
    request: CancelMessageRequest,
    context: ApiHandlerContext
): Promise<CancelMessageResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request.messageId) return { error: 'messageId is required' };

    try {
        const userId = toQueryId(context.userId) as ObjectId;
        const messageId = toQueryId(request.messageId) as ObjectId;

        const message = await findMessageById(messageId, userId);
        if (!message) return { error: 'Message not found' };
        if (message.status !== 'pending') {
            // Already finalized — treat as a successful no-op.
            return { cancelled: false };
        }

        const cancelled = await cancelPendingMessage(messageId, userId);

        // Unblock any `ask_user` tool still waiting on an answer for
        // this turn — otherwise it would keep polling until its own
        // timeout (and its eventual finalize is a no-op anyway).
        await cancelQuestionsForMessage(messageId);

        if (cancelled) {
            await appendTrace(
                messageId,
                { userId: context.userId, conversationId: message.conversationId },
                {
                    layer: 'vercel',
                    level: 'warn',
                    message: 'message.cancelled-by-user',
                }
            );
            await finishTrace(messageId, 'errored');
        }
        return { cancelled };
    } catch (error) {
        console.error('cancelMessage error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to cancel',
        };
    }
};
