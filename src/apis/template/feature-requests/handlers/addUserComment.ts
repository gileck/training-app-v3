import { ObjectId } from 'mongodb';
import { API_ADD_USER_COMMENT } from '../index';
import { AddUserCommentRequest, AddUserCommentResponse } from '../types';
import { featureRequests, users } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClientForUser } from './utils';
import { FeatureRequestComment } from '@/server/database/collections/template/feature-requests/types';
import { toDocumentId } from '@/server/utils';

export const addUserComment = async (
    request: AddUserCommentRequest,
    context: ApiHandlerContext
): Promise<AddUserCommentResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        if (!request.content?.trim()) {
            return { error: 'Comment content is required' };
        }

        // Verify the user owns this feature request
        const existingRequest = await featureRequests.findFeatureRequestById(request.requestId);
        if (!existingRequest) {
            return { error: 'Feature request not found' };
        }

        if (existingRequest.requestedBy.toString() !== context.userId) {
            return { error: 'You can only comment on your own feature requests' };
        }

        // Get user info for the comment
        const user = await users.findUserById(context.userId);
        const authorName = user?.username || user?.email || 'User';

        const comment: FeatureRequestComment = {
            id: request.commentId || new ObjectId().toString(),
            authorId: toDocumentId(context.userId) as ObjectId,
            authorName,
            isAdmin: false,
            content: request.content.trim(),
            createdAt: new Date(),
        };

        const updated = await featureRequests.addComment(request.requestId, comment);

        if (!updated) {
            return { error: 'Failed to add comment' };
        }

        return { featureRequest: toFeatureRequestClientForUser(updated) };
    } catch (error: unknown) {
        console.error('Add user comment error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to add comment' };
    }
};

export { API_ADD_USER_COMMENT };
