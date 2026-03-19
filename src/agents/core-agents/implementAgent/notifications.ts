/**
 * Post-implementation notifications and status updates.
 *
 * Handles notifying about missing bug diagnostics and sending
 * completion notifications after successful implementation.
 */

import {
    notifyAdmin,
    notifyPRReady,
} from '../../shared';

/**
 * Warn admin via Telegram if bug diagnostics are missing.
 */
export async function warnMissingBugDiagnostics(
    contentTitle: string,
    issueNumber: number,
): Promise<void> {
    await notifyAdmin(
        `\u26A0\uFE0F <b>Warning:</b> Bug diagnostics missing\n\n` +
        `\uD83D\uDCCB ${contentTitle}\n` +
        `\uD83D\uDD17 Issue #${issueNumber}\n\n` +
        `The bug report does not have diagnostics (session logs, stack trace). ` +
        `The implementation may be incomplete without this context.`
    );
}

/**
 * Send PR ready notification (for both new and feedback modes).
 */
export async function sendPRReadyNotification(
    contentTitle: string,
    issueNumber: number,
    prNumber: number,
    isFeedback: boolean,
    issueType: 'bug' | 'feature',
    comment: string | undefined,
): Promise<void> {
    await notifyPRReady(contentTitle, issueNumber, prNumber, isFeedback, issueType, comment);
    console.log('  Notification sent');
}
