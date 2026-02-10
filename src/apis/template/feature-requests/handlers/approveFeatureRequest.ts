import { API_APPROVE_FEATURE_REQUEST } from '../index';
import { ApproveFeatureRequestRequest, ApproveFeatureRequestResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';
import { approveWorkflowItem } from '@/server/workflow-service';
import { featureRequests } from '@/server/database';

export const approveFeatureRequest = async (
    request: ApproveFeatureRequestRequest,
    context: ApiHandlerContext
): Promise<ApproveFeatureRequestResponse> => {
    try {
        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        const result = await approveWorkflowItem({ id: request.requestId, type: 'feature' });

        if (!result.success) {
            return { error: result.error || 'Failed to approve feature request' };
        }

        // Fetch the updated feature request for the response
        const featureRequest = await featureRequests.findFeatureRequestById(request.requestId);
        if (!featureRequest) {
            return { error: 'Feature request not found after approval' };
        }

        return {
            featureRequest: toFeatureRequestClient(featureRequest),
            githubIssueUrl: result.issueUrl,
            githubIssueNumber: result.issueNumber,
            needsRouting: result.needsRouting,
        };
    } catch (error: unknown) {
        console.error('Approve feature request error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to approve feature request' };
    }
};

export { API_APPROVE_FEATURE_REQUEST };
