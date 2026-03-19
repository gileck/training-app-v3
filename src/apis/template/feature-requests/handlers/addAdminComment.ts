import { ObjectId } from 'mongodb';
import { API_ADD_ADMIN_COMMENT } from '../index';
import { AddAdminCommentRequest, AddAdminCommentResponse } from '../types';
import { featureRequests, users } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';
import { FeatureRequestComment } from '@/server/database/collections/template/feature-requests/types';
import { toDocumentId } from '@/server/template/utils';

export const addAdminComment = async (
    request: AddAdminCommentRequest,
    context: ApiHandlerContext
): Promise<AddAdminCommentResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!context.userId) {
            return { error: 'Authentication required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        if (!request.content?.trim()) {
            return { error: 'Comment content is required' };
        }

        // Get admin user info for the comment
        const user = await users.findUserById(context.userId);
        const authorName = user?.username || user?.email || 'Admin';

        const comment: FeatureRequestComment = {
            id: request.commentId || new ObjectId().toString(),
            authorId: toDocumentId(context.userId) as ObjectId,
            authorName,
            isAdmin: true,
            content: request.content.trim(),
            createdAt: new Date(),
        };

        const updated = await featureRequests.addComment(request.requestId, comment);

        if (!updated) {
            return { error: 'Feature request not found' };
        }

        return { featureRequest: toFeatureRequestClient(updated) };
    } catch (error: unknown) {
        console.error('Add admin comment error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to add comment' };
    }
};

export { API_ADD_ADMIN_COMMENT };
