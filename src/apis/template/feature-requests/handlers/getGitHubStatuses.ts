import { API_GET_GITHUB_STATUSES } from '../index';
import { GetGitHubStatusesRequest, GetGitHubStatusesResponse } from '../types';
import { ApiHandlerContext } from '@/apis/types';
import { getAvailableStatuses, getAvailableReviewStatuses } from '@/server/github-status';

export const getGitHubStatuses = async (
    _request: GetGitHubStatusesRequest,
    context: ApiHandlerContext
): Promise<GetGitHubStatusesResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Authentication required' };
        }

        const [statuses, reviewStatuses] = await Promise.all([
            getAvailableStatuses(),
            getAvailableReviewStatuses(),
        ]);

        return { statuses, reviewStatuses };
    } catch (error: unknown) {
        console.error('Get GitHub statuses error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to get GitHub statuses' };
    }
};

export { API_GET_GITHUB_STATUSES };
