import { API_DELETE_FEATURE_REQUEST } from '../index';
import { DeleteFeatureRequestRequest, DeleteFeatureRequestResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { deleteWorkflowItem } from '@/server/workflow-service';

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

        const result = await deleteWorkflowItem({ id: request.requestId, type: 'feature' });

        if (!result.success) {
            return { error: result.error || 'Failed to delete feature request' };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('Delete feature request error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to delete feature request' };
    }
};

export { API_DELETE_FEATURE_REQUEST };
