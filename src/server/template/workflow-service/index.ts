/**
 * Workflow Service
 *
 * Unified service layer for workflow item lifecycle operations.
 * All transports (Telegram, UI, CLI) call these functions.
 *
 * Phase 1: Entry operations (approve, route, delete)
 * Phase 2: Mid-pipeline operations (advance, review, phase, undo, etc.)
 */

// Phase 1 — Entry operations
export { approveWorkflowItem } from './approve';
export { routeWorkflowItem, routeWorkflowItemByWorkflowId } from './route';
export { deleteWorkflowItem } from './delete';

// Phase 2 — Mid-pipeline operations
export { updateReviewStatus, clearReviewStatus } from './review-status';
export { advanceStatus, markDone } from './advance';
export { setWorkflowStatus } from './set-status';
export { advanceImplementationPhase, clearImplementationPhase } from './phase';
export { completeAgentRun } from './agent-complete';
export { submitDecisionRouting } from './decision';
export { undoStatusChange } from './undo';
export { autoAdvanceApproved } from './auto-advance';

// Phase 3 — UI/Telegram shared actions
export { reviewDesign } from './design-review';
export { markClarificationReceived } from './clarification';
export { requestChangesOnPR } from './request-changes';
export { requestChangesOnDesignPR } from './request-changes-design';
export { chooseRecommendedOption } from './choose-recommended';

// Phase 4 — Merge/Revert operations
export { approveDesign } from './approve-design';
/** @deprecated Use approveDesign instead */
export { mergeDesignPR } from './merge-design-pr';
export { mergeImplementationPR } from './merge-pr';
export { mergeFinalPR } from './merge-final-pr';
export { revertMerge, mergeRevertPR } from './revert';

// Utilities
export { findItemByIssueNumber, findSourceDocByIssueNumber, syncWorkflowStatus, getInitializedAdapter } from './utils';
export type { ServiceProjectItem, SourceDocInfo } from './utils';

// Types
export type {
    ItemType,
    RoutingDestination,
    WorkflowItemRef,
    ApproveOptions,
    ApproveResult,
    RouteResult,
    DeleteOptions,
    DeleteResult,
    ServiceOptions,
    ServiceResult,
    AdvanceResult,
    MarkDoneResult,
    UndoResult,
    UndoOptions,
    AutoAdvanceResult,
    AgentCompletionResult,
} from './types';
export type { DesignReviewResult } from './design-review';
export type { ApproveDesignResult } from './approve-design';
export type { MergeDesignPRResult } from './merge-design-pr';
export type { MergePRResult } from './merge-pr';
export type { MergeFinalPRResult } from './merge-final-pr';
export type { RevertResult } from './revert';
export type { ChooseRecommendedResult } from './choose-recommended';

// Constants
export {
    FEATURE_ROUTING_STATUS_MAP,
    BUG_ROUTING_STATUS_MAP,
    ROUTING_DESTINATION_LABELS,
    getRoutingStatusMap,
    statusToDestination,
    STATUS_TRANSITIONS,
    DEFAULT_UNDO_WINDOW_MS,
} from './constants';
