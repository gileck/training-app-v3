/**
 * Mock notifications — captures all notification calls for assertions.
 */

export interface CapturedNotification {
    fn: string;
    args: unknown[];
}

export const capturedNotifications: CapturedNotification[] = [];

const SUCCESS = { success: true };

function capture(fn: string) {
    return (...args: unknown[]) => {
        capturedNotifications.push({ fn, args });
        return Promise.resolve(SUCCESS);
    };
}

export const notifyIssueSynced = capture('notifyIssueSynced');
export const notifyProductDevelopmentReady = capture('notifyProductDevelopmentReady');
export const notifyProductDesignReady = capture('notifyProductDesignReady');
export const notifyTechDesignReady = capture('notifyTechDesignReady');
export const notifyPRReady = capture('notifyPRReady');
export const notifyPRReviewComplete = capture('notifyPRReviewComplete');
export const notifyPRReadyToMerge = capture('notifyPRReadyToMerge');
export const notifyMergeComplete = capture('notifyMergeComplete');
export const notifyDecisionAutoSubmitted = capture('notifyDecisionAutoSubmitted');
export const notifyAgentNeedsClarification = capture('notifyAgentNeedsClarification');
export const notifyAgentError = capture('notifyAgentError');
export const notifyBatchComplete = capture('notifyBatchComplete');
export const notifyAutoAdvance = capture('notifyAutoAdvance');
export const notifyAdmin = capture('notifyAdmin');
export const notifyAgentStarted = capture('notifyAgentStarted');
export const notifyDesignPRReady = capture('notifyDesignPRReady');
export const notifyFinalReviewReady = capture('notifyFinalReviewReady');
export const notifyPhaseComplete = capture('notifyPhaseComplete');
export const notifyPhaseMergedToFeatureBranch = capture('notifyPhaseMergedToFeatureBranch');
export const notifyFinalMergeComplete = capture('notifyFinalMergeComplete');
export const notifyDecisionSubmitted = capture('notifyDecisionSubmitted');
export const notifyDecisionNeeded = capture('notifyDecisionNeeded');

export function resetNotifications(): void {
    capturedNotifications.length = 0;
}
