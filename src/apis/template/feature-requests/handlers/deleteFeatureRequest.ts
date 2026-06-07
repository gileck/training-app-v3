import { API_DELETE_FEATURE_REQUEST } from '../index';
import { DeleteFeatureRequestRequest, DeleteFeatureRequestResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { deleteFeatureRequest as deleteFeatureRequestFromDb } from '@/server/database/collections/template/feature-requests';

export const deleteFeatureRequest = async (
    request: DeleteFeatureRequestRequest,
    context: ApiHandlerContext
): Promise<DeleteFeatureRequestResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        const deleted = await deleteFeatureRequestFromDb(request.requestId);

        if (!deleted) {
            return { error: 'Failed to delete feature request' };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('Delete feature request error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to delete feature request' };
    }
};

export { API_DELETE_FEATURE_REQUEST };
