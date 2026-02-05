import { API_UPDATE_ADMIN_NOTES } from '../index';
import { UpdateAdminNotesRequest, UpdateAdminNotesResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';

export const updateAdminNotes = async (
    request: UpdateAdminNotesRequest,
    context: ApiHandlerContext
): Promise<UpdateAdminNotesResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        const updated = await featureRequests.updateAdminNotes(
            request.requestId,
            request.adminNotes || ''
        );

        if (!updated) {
            return { error: 'Feature request not found' };
        }

        return { featureRequest: toFeatureRequestClient(updated) };
    } catch (error: unknown) {
        console.error('Update admin notes error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update admin notes' };
    }
};

export { API_UPDATE_ADMIN_NOTES };
