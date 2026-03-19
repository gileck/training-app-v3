import crypto from 'crypto';
import { API_CREATE_FEATURE_REQUEST } from '../index';
import { CreateFeatureRequestRequest, CreateFeatureRequestResponse } from '../types';
import { featureRequests, users } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClientForUser } from './utils';
import { toDocumentId } from '@/server/template/utils';
import { sendFeatureRequestNotification } from '@/server/template/telegram';
import type { ObjectId } from 'mongodb';

/**
 * Generate a secure approval token
 */
function generateApprovalToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

export const createFeatureRequest = async (
    request: CreateFeatureRequestRequest,
    context: ApiHandlerContext
): Promise<CreateFeatureRequestResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }

        if (!request.title?.trim()) {
            return { error: 'Title is required' };
        }

        if (!request.description?.trim()) {
            return { error: 'Description is required' };
        }

        const now = new Date();
        const approvalToken = generateApprovalToken();

        // Get user info for the request
        const user = await users.findUserById(context.userId);
        const requestedByName = user?.username || user?.email || 'User';

        const requestData = {
            title: request.title.trim(),
            description: request.description.trim(),
            page: request.page?.trim() || undefined,
            status: 'new' as const,
            needsUserInput: false,
            requestedBy: toDocumentId(context.userId) as ObjectId,
            requestedByName,
            comments: [],
            approvalToken,
            source: 'ui' as const,
            createdAt: now,
            updatedAt: now,
        };

        const newRequest = await featureRequests.createFeatureRequest(requestData);

        // Send Telegram notification to admin with approval button
        try {
            await sendFeatureRequestNotification(newRequest);
        } catch (notifyError) {
            // Don't fail the request if notification fails
            console.error('[Telegram] Failed to send notification:', notifyError);
        }

        return { featureRequest: toFeatureRequestClientForUser(newRequest) };
    } catch (error: unknown) {
        console.error('Create feature request error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to create feature request' };
    }
};

export { API_CREATE_FEATURE_REQUEST };
