import { API_APPROVE_FEATURE_REQUEST } from '../index';
import { ApproveFeatureRequestRequest, ApproveFeatureRequestResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { toFeatureRequestClient } from './utils';
import { approveFeatureRequest as approveFeatureRequestService } from '@/server/github-sync';

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

        const result = await approveFeatureRequestService(request.requestId);

        if (!result.success) {
            return { error: result.error || 'Failed to approve feature request' };
        }

        if (!result.featureRequest) {
            return { error: 'Feature request not found after approval' };
        }

        return {
            featureRequest: toFeatureRequestClient(result.featureRequest),
            githubIssueUrl: result.githubResult?.issueUrl,
            githubIssueNumber: result.githubResult?.issueNumber,
        };
    } catch (error: unknown) {
        console.error('Approve feature request error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to approve feature request' };
    }
};

export { API_APPROVE_FEATURE_REQUEST };
