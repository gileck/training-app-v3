import { API_UPDATE_GITHUB_STATUS } from '../index';
import { UpdateGitHubStatusRequest, UpdateGitHubStatusResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { updateGitHubProjectStatus } from '@/server/github-status';

export const updateGitHubStatus = async (
    request: UpdateGitHubStatusRequest,
    context: ApiHandlerContext
): Promise<UpdateGitHubStatusResponse> => {
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

        if (!request.status) {
            return { error: 'Status is required' };
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

        // Update the GitHub Project status
        const success = await updateGitHubProjectStatus(
            featureRequest.githubProjectItemId,
            request.status
        );

        if (!success) {
            return { error: 'Failed to update GitHub status' };
        }

        // Clear Review Status when manually changing status (admin is essentially approving/advancing)
        // This prevents "Waiting for Review" from being stuck when moving to the next phase
        const { updateGitHubReviewStatus } = await import('@/server/github-status');
        await updateGitHubReviewStatus(featureRequest.githubProjectItemId, '');

        return { success: true };
    } catch (error: unknown) {
        console.error('Update GitHub status error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to update GitHub status' };
    }
};

export { API_UPDATE_GITHUB_STATUS };
