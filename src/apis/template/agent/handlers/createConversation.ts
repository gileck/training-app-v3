import type { ObjectId } from 'mongodb';
import { agentConversations } from '@/server/database';
import { toQueryId } from '@/server/template/utils';
import type { ApiHandlerContext } from '@/apis/types';
import type {
    CreateConversationRequest,
    CreateConversationResponse,
} from '../types';

export const createConversation = async (
    request: CreateConversationRequest,
    context: ApiHandlerContext
): Promise<CreateConversationResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request.modelId) return { error: 'modelId is required' };

    try {
        const doc = await agentConversations.createConversation({
            userId: toQueryId(context.userId) as ObjectId,
            title: request.title?.trim() || 'New conversation',
            modelId: request.modelId,
        });
        return { conversation: agentConversations.toConversationClient(doc) };
    } catch (error) {
        console.error('createConversation error:', error);
        return {
            error:
                error instanceof Error
                    ? error.message
                    : 'Failed to create conversation',
        };
    }
};
