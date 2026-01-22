// Must re-export all exports from index.ts
export * from './index';

// Import API name constants from index.ts
import {
    API_CREATE_FEATURE_REQUEST,
    API_GET_MY_FEATURE_REQUESTS,
    API_ADD_USER_COMMENT,
    API_GET_FEATURE_REQUESTS,
    API_GET_FEATURE_REQUEST,
    API_UPDATE_FEATURE_REQUEST_STATUS,
    API_UPDATE_DESIGN_REVIEW_STATUS,
    API_UPDATE_DESIGN_CONTENT,
    API_ADD_ADMIN_COMMENT,
    API_UPDATE_ADMIN_NOTES,
    API_UPDATE_PRIORITY,
    API_SET_NEEDS_USER_INPUT,
    API_DELETE_FEATURE_REQUEST,
    API_APPROVE_FEATURE_REQUEST,
    API_GET_GITHUB_STATUS,
    API_GET_GITHUB_STATUSES,
    API_UPDATE_GITHUB_STATUS,
    API_UPDATE_GITHUB_REVIEW_STATUS,
    API_CLEAR_GITHUB_REVIEW_STATUS,
    API_GET_GITHUB_ISSUE_DETAILS,
} from './index';

// Import handlers
import { createFeatureRequest } from './handlers/createFeatureRequest';
import { getMyFeatureRequests } from './handlers/getMyFeatureRequests';
import { addUserComment } from './handlers/addUserComment';
import { getFeatureRequests } from './handlers/getFeatureRequests';
import { getFeatureRequest } from './handlers/getFeatureRequest';
import { updateFeatureRequestStatus } from './handlers/updateFeatureRequestStatus';
import { updateDesignReviewStatus } from './handlers/updateDesignReviewStatus';
import { updateDesignContent } from './handlers/updateDesignContent';
import { addAdminComment } from './handlers/addAdminComment';
import { updateAdminNotes } from './handlers/updateAdminNotes';
import { updatePriority } from './handlers/updatePriority';
import { setNeedsUserInput } from './handlers/setNeedsUserInput';
import { deleteFeatureRequest } from './handlers/deleteFeatureRequest';
import { approveFeatureRequest } from './handlers/approveFeatureRequest';
import { getGitHubStatus } from './handlers/getGitHubStatus';
import { getGitHubStatuses } from './handlers/getGitHubStatuses';
import { updateGitHubStatus } from './handlers/updateGitHubStatus';
import { updateGitHubReviewStatusHandler } from './handlers/updateGitHubReviewStatus';
import { clearGitHubReviewStatusHandler } from './handlers/clearGitHubReviewStatus';
import { getGitHubIssueDetails } from './handlers/getGitHubIssueDetails';

// Export consolidated handlers object
export const featureRequestsApiHandlers = {
    [API_CREATE_FEATURE_REQUEST]: { process: createFeatureRequest },
    [API_GET_MY_FEATURE_REQUESTS]: { process: getMyFeatureRequests },
    [API_ADD_USER_COMMENT]: { process: addUserComment },
    [API_GET_FEATURE_REQUESTS]: { process: getFeatureRequests },
    [API_GET_FEATURE_REQUEST]: { process: getFeatureRequest },
    [API_UPDATE_FEATURE_REQUEST_STATUS]: { process: updateFeatureRequestStatus },
    [API_UPDATE_DESIGN_REVIEW_STATUS]: { process: updateDesignReviewStatus },
    [API_UPDATE_DESIGN_CONTENT]: { process: updateDesignContent },
    [API_ADD_ADMIN_COMMENT]: { process: addAdminComment },
    [API_UPDATE_ADMIN_NOTES]: { process: updateAdminNotes },
    [API_UPDATE_PRIORITY]: { process: updatePriority },
    [API_SET_NEEDS_USER_INPUT]: { process: setNeedsUserInput },
    [API_DELETE_FEATURE_REQUEST]: { process: deleteFeatureRequest },
    [API_APPROVE_FEATURE_REQUEST]: { process: approveFeatureRequest },
    [API_GET_GITHUB_STATUS]: { process: getGitHubStatus },
    [API_GET_GITHUB_STATUSES]: { process: getGitHubStatuses },
    [API_UPDATE_GITHUB_STATUS]: { process: updateGitHubStatus },
    [API_UPDATE_GITHUB_REVIEW_STATUS]: { process: updateGitHubReviewStatusHandler },
    [API_CLEAR_GITHUB_REVIEW_STATUS]: { process: clearGitHubReviewStatusHandler },
    [API_GET_GITHUB_ISSUE_DETAILS]: { process: getGitHubIssueDetails },
};
