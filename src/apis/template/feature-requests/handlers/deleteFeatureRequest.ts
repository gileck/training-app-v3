import { API_DELETE_FEATURE_REQUEST } from '../index';
import { DeleteFeatureRequestRequest, DeleteFeatureRequestResponse } from '../types';
import { featureRequests } from '@/server/database';
import { deleteWorkflowItemBySourceRef } from '@/server/database/collections/template/workflow-items';
import { ApiHandlerContext } from '@/apis/types';

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

        const deleted = await featureRequests.deleteFeatureRequest(request.requestId);

        // Always clean up the associated workflow item (handles orphaned items)
        const workflowDeleted = await deleteWorkflowItemBySourceRef('feature-requests', request.requestId);

        if (!deleted && !workflowDeleted) {
            return { error: 'Feature request not found' };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('Delete feature request error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to delete feature request' };
    }
};

export { API_DELETE_FEATURE_REQUEST };
