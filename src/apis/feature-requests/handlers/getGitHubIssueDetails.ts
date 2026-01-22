import { GetGitHubIssueDetailsRequest, GetGitHubIssueDetailsResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { getProjectManagementAdapter } from '@/server/project-management';

export const getGitHubIssueDetails = async (
    request: GetGitHubIssueDetailsRequest,
    context: ApiHandlerContext
): Promise<GetGitHubIssueDetailsResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }

        if (!request.requestId) {
            return { error: 'Request ID is required' };
        }

        // Get the feature request
        const featureRequest = await featureRequests.findFeatureRequestById(request.requestId);

        if (!featureRequest) {
            return { error: 'Feature request not found' };
        }

        // Check if user owns this request or is admin
        const isOwner = featureRequest.requestedBy.toString() === context.userId;
        if (!isOwner && !context.isAdmin) {
            return { error: 'Access denied' };
        }

        // Check if we have a GitHub issue number
        if (!featureRequest.githubIssueNumber) {
            return { error: 'No GitHub issue linked to this feature request' };
        }

        // Fetch issue details from GitHub
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        const issueDetails = await adapter.getIssueDetails(featureRequest.githubIssueNumber);

        if (!issueDetails) {
            return { error: 'Failed to fetch GitHub issue details' };
        }

        return { issueDetails };
    } catch (error: unknown) {
        console.error('Get GitHub issue details error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get GitHub issue details' };
    }
};
