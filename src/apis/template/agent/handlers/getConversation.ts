import type { ObjectId } from 'mongodb';
import { agentConversations } from '@/server/database';
import {
    findQuestionsByConversationId,
    toQuestionClient,
} from '@/server/database/collections/template/agentQuestions/agentQuestions';
import {
    appendTrace,
    finishTrace,
} from '@/server/database/collections/template/agentTraces/agentTraces';
import { findRpcJobBySourceMessageId } from '@/server/template/rpc/collection';
import { toQueryId, toStringId } from '@/server/template/utils';
import type { ApiHandlerContext } from '@/apis/types';
import type {
    GetConversationRequest,
    GetConversationResponse,
} from '../types';

/**
 * For each pending assistant message, look up the matching rpc-jobs
 * row. If the daemon already marked the job `failed` (most commonly a
 * module-import error before our handler ran — those don't show up in
 * agentTraces), flip the assistant message to `errored` with the
 * real reason. Self-healing reconciliation — no client action needed.
 *
 * Done inline on read so we don't need a cron; the cost is one extra
 * DB read per pending message, which is bounded since pending
 * messages are normally <= 1 per conversation.
 */
async function reconcilePendingMessages(input: {
    conversationId: ObjectId;
    userId: string;
    pending: ReadonlyArray<{ id: string; createdAt: string }>;
}): Promise<void> {
    if (input.pending.length === 0) return;
    const adapter = agentConversations.makeAgentConversationsAdapter(
        input.userId
    );

    await Promise.all(
        input.pending.map(async (pendingMsg) => {
            try {
                const job = await findRpcJobBySourceMessageId(pendingMsg.id);
                if (!job || job.status !== 'failed') return;
                const errorMsg = job.error ?? 'Daemon error';
                const messageObjectId = toQueryId(pendingMsg.id) as ObjectId;
                await appendTrace(
                    messageObjectId,
                    {
                        userId: input.userId,
                        conversationId: input.conversationId,
                    },
                    {
                        layer: 'daemon',
                        level: 'error',
                        message: 'rpc-job.failed',
                        data: { error: errorMsg },
                    }
                );
                await adapter.finalizeAssistantMessage({
                    id: messageObjectId,
                    content: `Daemon error: ${errorMsg}`,
                    cost: 0,
                    events: [],
                });
                await finishTrace(messageObjectId, 'errored');
            } catch (err) {
                // Reconciliation is best-effort — never fail the read.
                console.error('reconcilePendingMessages failed:', err);
            }
        })
    );
}

export const getConversation = async (
    request: GetConversationRequest,
    context: ApiHandlerContext
): Promise<GetConversationResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request.conversationId) return { error: 'conversationId is required' };

    try {
        const userId = toQueryId(context.userId) as ObjectId;
        const conversationId = toQueryId(request.conversationId) as ObjectId;

        const conversation = await agentConversations.findConversationById(
            conversationId,
            userId
        );
        if (!conversation) return { error: 'Conversation not found' };

        let messages = await agentConversations.findMessagesByConversationId(
            conversationId,
            userId
        );

        const pending = messages
            .filter((m) => m.status === 'pending')
            .map((m) => ({
                id: toStringId(m._id),
                createdAt: m.createdAt.toISOString(),
            }));

        if (pending.length > 0) {
            await reconcilePendingMessages({
                conversationId,
                userId: context.userId,
                pending,
            });
            // Re-read after potential mutations so the response
            // reflects the reconciled state.
            messages =
                await agentConversations.findMessagesByConversationId(
                    conversationId,
                    userId
                );
        }

        const questions = await findQuestionsByConversationId(
            conversationId,
            userId
        );

        return {
            conversation: agentConversations.toConversationClient(conversation),
            messages: messages.map(agentConversations.toMessageClient),
            questions: questions.map(toQuestionClient),
        };
    } catch (error) {
        console.error('getConversation error:', error);
        return {
            error:
                error instanceof Error ? error.message : 'Failed to load conversation',
        };
    }
};
