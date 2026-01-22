import crypto from 'crypto';
import { API_CREATE_FEATURE_REQUEST } from '../index';
import { CreateFeatureRequestRequest, CreateFeatureRequestResponse } from '../types';
import { featureRequests, users } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClientForUser } from './utils';
import { toDocumentId } from '@/server/utils';
import { sendNotificationToOwner } from '@/server/telegram';
import type { ObjectId } from 'mongodb';

/**
 * Generate a secure approval token
 */
function generateApprovalToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the base URL for the app
 */
function getBaseUrl(): string {
    // Use VERCEL_URL in production, fallback to localhost
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    return 'http://localhost:3000';
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
            createdAt: now,
            updatedAt: now,
        };

        const newRequest = await featureRequests.createFeatureRequest(requestData);

        // Send Telegram notification to admin with approval button
        try {
            const baseUrl = getBaseUrl();
            const isHttps = baseUrl.startsWith('https://');

            const message = [
                `📝 New Feature Request!`,
                ``,
                `📋 ${newRequest.title}`,
                ``,
                `${newRequest.description.slice(0, 300)}${newRequest.description.length > 300 ? '...' : ''}`,
                newRequest.page ? `\n📍 Page: ${newRequest.page}` : '',
            ].filter(Boolean).join('\n');

            // Use callback button for webhook (works in production)
            // Fall back to URL link for localhost (webhook not available)
            if (isHttps) {
                // Callback data format: "approve_request:requestId"
                // Note: Token is verified from database when webhook is called
                // (Telegram has 64-byte limit on callback_data, so we can't include the token)
                const callbackData = `approve_request:${newRequest._id}`;
                await sendNotificationToOwner(message, {
                    inlineKeyboard: [[
                        { text: '✅ Approve & Create GitHub Issue', callback_data: callbackData }
                    ]]
                });
            } else {
                // Localhost fallback - use URL button
                const approveUrl = `${baseUrl}/api/feature-requests/approve/${newRequest._id}?token=${approvalToken}`;
                const localMessage = `${message}\n\n🔗 Approve: ${approveUrl}`;
                await sendNotificationToOwner(localMessage);
            }
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
