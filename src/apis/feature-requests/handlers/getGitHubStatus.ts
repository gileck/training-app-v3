import { API_GET_GITHUB_STATUS } from '../index';
import { GetGitHubStatusRequest, GetGitHubStatusResponse } from '../types';
import { featureRequests } from '@/server/database';
import { ApiHandlerContext } from '@/apis/types';
import { getGitHubProjectStatus } from '@/server/github-status';

export const getGitHubStatus = async (
    request: GetGitHubStatusRequest,
    context: ApiHandlerContext
): Promise<GetGitHubStatusResponse> => {
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

        // Check if we have a GitHub project item ID
        if (!featureRequest.githubProjectItemId) {
            return {
                status: null,
                reviewStatus: null,
                issueState: null,
                issueUrl: featureRequest.githubIssueUrl,
            };
        }

        // Fetch live status from GitHub
        const githubStatus = await getGitHubProjectStatus(featureRequest.githubProjectItemId);

        if (!githubStatus) {
            return {
                status: null,
                reviewStatus: null,
                issueState: null,
                issueUrl: featureRequest.githubIssueUrl,
            };
        }

        return {
            status: githubStatus.status,
            reviewStatus: githubStatus.reviewStatus,
            issueState: githubStatus.issueState,
            issueUrl: featureRequest.githubIssueUrl,
        };
    } catch (error: unknown) {
        console.error('Get GitHub status error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get GitHub status' };
    }
};

export { API_GET_GITHUB_STATUS };
