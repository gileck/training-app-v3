/**
 * Telegram Notifications for Agent Scripts
 *
 * Provides notification functions for each step of the GitHub Projects workflow.
 * Supports inline keyboard buttons for quick approve/reject actions.
 *
 * This barrel re-exports all notification sub-modules for backward compatibility.
 * Existing imports like `from '../shared/notifications'` continue to work.
 */

// Types
export type { SendResult, InlineButton, InlineKeyboardMarkup } from './types';

// Helpers (escapeHtml, getAppUrl, sleep)
export { escapeHtml, getAppUrl, sleep } from './helpers';

// Button builders
export {
    buildViewPRButton,
    buildIssueReviewButtons,
    buildViewIssueButton,
    buildViewProjectButton,
} from './buttons';

// Telegram API (sendToAdmin, sendToInfoChannel)
export { sendToAdmin, sendToInfoChannel } from './telegram-api';

// Notification senders (all notify* functions)
export {
    notifyIssueSynced,
    notifyProductDevelopmentReady,
    notifyProductDesignReady,
    notifyTechDesignReady,
    notifyPRReady,
    notifyPRReviewComplete,
    notifyPRReadyToMerge,
    notifyMergeComplete,
    notifyDecisionAutoSubmitted,
    notifyAgentNeedsClarification,
    notifyAgentError,
    notifyBatchComplete,
    notifyAutoAdvance,
    notifyAdmin,
    notifyAgentStarted,
    notifyDesignPRReady,
    notifyFinalReviewReady,
    notifyPhaseComplete,
    notifyPhaseMergedToFeatureBranch,
    notifyFinalMergeComplete,
    notifyDecisionSubmitted,
    notifyWorkflowReviewComplete,
    notifyDecisionNeeded,
} from './senders';
