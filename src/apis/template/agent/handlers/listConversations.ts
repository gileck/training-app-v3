import type { ObjectId } from 'mongodb';
import { agentConversations } from '@/server/database';
import { toQueryId } from '@/server/template/utils';
import type { ApiHandlerContext } from '@/apis/types';
import type {
    ListConversationsRequest,
    ListConversationsResponse,
} from '../types';

export const listConversations = async (
    _request: ListConversationsRequest,
    context: ApiHandlerContext
): Promise<ListConversationsResponse> => {
    if (!context.userId) return { error: 'Not authenticated' };
    try {
        const docs = await agentConversations.findConversationsByUserId(
            toQueryId(context.userId) as ObjectId
        );
        return { conversations: docs.map(agentConversations.toConversationClient) };
    } catch (error) {
        console.error('listConversations error:', error);
        return {
            error:
                error instanceof Error ? error.message : 'Failed to list conversations',
        };
    }
};
