/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Export all handlers from a single entry point
 */

export { handleFeatureRequestApproval, handleBugReportApproval, handleFeatureRequestDeletion, handleBugReportDeletion, handleFeatureRequestApprovalToBacklog, handleBugReportApprovalToBacklog } from './approval';
export { handleFeatureRouting, handleBugRouting } from './routing';
export { handleDesignReviewAction } from './design-review';
export { handleClarificationReceived } from './clarification';
export { handleMergeCallback, handleMergeFinalPRCallback, handleRevertMerge, handleMergeRevertPR } from './merge';
export { handleDesignPRApproval, handleDesignPRRequestChanges, handleRequestChangesCallback } from './design-pr';
export { handleUndoRequestChanges, handleUndoDesignChanges, handleUndoDesignReview } from './undo';
export { handleChooseRecommended } from './handle-choose-recommended';
