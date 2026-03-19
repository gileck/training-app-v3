import { API_CLEAR_GITHUB_REVIEW_STATUS } from '../index';
import { ClearGitHubReviewStatusRequest, ClearGitHubReviewStatusResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { clearGitHubReviewStatus } from '@/server/template/github-status';

export const clearGitHubReviewStatusHandler = async (
    request: ClearGitHubReviewStatusRequest,
    context: ApiHandlerContext
): Promise<ClearGitHubReviewStatusResponse> => {
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

        // Get the feature request
        const featureRequest = await featureRequests.findFeatureRequestById(request.requestId);

        if (!featureRequest) {
            return { error: 'Feature request not found' };
        }

        // Check if we have a GitHub project item ID
        if (!featureRequest.githubProjectItemId) {
            return { error: 'Feature request is not linked to GitHub' };
        }

        // Clear the GitHub Project review status
        const success = await clearGitHubReviewStatus(featureRequest.githubProjectItemId);

        if (!success) {
            return { error: 'Failed to clear GitHub review status' };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error('Clear GitHub review status error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to clear GitHub review status' };
    }
};

export { API_CLEAR_GITHUB_REVIEW_STATUS };
