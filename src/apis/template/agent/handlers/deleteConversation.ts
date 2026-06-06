import type { ObjectId } from 'mongodb';
import { agentConversations } from '@/server/database';
import { toQueryId } from '@/server/template/utils';
import type { ApiHandlerContext } from '@/apis/types';
import type {
    DeleteConversationRequest,
    DeleteConversationResponse,
} from '../types';

export const deleteConversation = async (
    request: DeleteConversationRequest,
    context: ApiHandlerContext
): Promise<DeleteConversationResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request.conversationId) return { error: 'conversationId is required' };

    try {
        const userId = toQueryId(context.userId) as ObjectId;
        const conversationId = toQueryId(request.conversationId) as ObjectId;

        const deleted = await agentConversations.deleteConversation(
            conversationId,
            userId
        );
        if (deleted) {
            await agentConversations.deleteMessagesByConversationId(
                conversationId,
                userId
            );
        }
        return { deleted };
    } catch (error) {
        console.error('deleteConversation error:', error);
        return {
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to delete conversation',
        };
    }
};
