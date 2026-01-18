import { API_CREATE_FEATURE_REQUEST } from '../index';
import { CreateFeatureRequestRequest, CreateFeatureRequestResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClientForUser } from './utils';
import { toDocumentId } from '@/server/utils';
import type { ObjectId } from 'mongodb';

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

        const requestData = {
            title: request.title.trim(),
            description: request.description.trim(),
            page: request.page?.trim() || undefined,
            status: 'new' as const,
            needsUserInput: false,
            requestedBy: toDocumentId(context.userId) as ObjectId,
            comments: [],
            createdAt: now,
            updatedAt: now,
        };

        const newRequest = await featureRequests.createFeatureRequest(requestData);

        return { featureRequest: toFeatureRequestClientForUser(newRequest) };
    } catch (error: unknown) {
        console.error('Create feature request error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to create feature request' };
    }
};

export { API_CREATE_FEATURE_REQUEST };
