import { API_UPDATE_GITHUB_REVIEW_STATUS } from '../index';
import { UpdateGitHubReviewStatusRequest, UpdateGitHubReviewStatusResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { updateGitHubReviewStatus } from '@/server/template/github-status';

export const updateGitHubReviewStatusHandler = async (
    request: UpdateGitHubReviewStatusRequest,
    context: ApiHandlerContext
): Promise<UpdateGitHubReviewStatusResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }

        if (!context.isAdmin) {
            return { error: 'Admin access required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        if (!request.reviewStatus) {
            return { error: 'Review status is required' };
        }

        // Get the feature request
        const featureRequest = await featureRequests.findFeatureRequestById(request.requestId);

        if (!featureRequest) {
            return { error: 'Feature request not found' };
        }

        // Check if we have a GitHub project item ID
        if (!featureRequest.githubProjectItemId) {
            return { error: 'Feature request is not linked to GitHub' };
        }

        // Update the GitHub Project review status
        const success = await updateGitHubReviewStatus(
            featureRequest.githubProjectItemId,
            request.reviewStatus
        );

        if (!success) {
            return { error: 'Failed to update GitHub review status' };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('Update GitHub review status error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update GitHub review status' };
    }
};

export { API_UPDATE_GITHUB_REVIEW_STATUS };
