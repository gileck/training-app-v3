/**
 * Workflow Service — Choose Recommended
 *
 * Encapsulates the full "choose recommended option" flow so both
 * the UI (workflowAction) and Telegram (handleChooseRecommended)
 * share a single code path through the service layer.
 *
 * Steps:
 * 1. Fetch decision data from DB (fallback: parse GitHub comments)
 * 2. Find the recommended option
 * 3. Compute routing target from decision's routing config
 * 4. Post decision comment to GitHub (audit trail)
 * 5. Save selection to DB
 * 6. Call submitDecisionRouting() for the status update
 * 7. Send Telegram notification
 */

import { getProjectManagementAdapter } from '@/server/template/project-management';
import { REVIEW_STATUSES } from '@/server/template/project-management/config';
import {
    isDecisionComment,
    parseDecision,
    formatDecisionSelectionComment,
    findDecisionItem,
    getDecisionFromDB,
    saveSelectionToDB,
} from '@/apis/template/agent-decision/utils';
import type { DecisionSelection } from '@/apis/template/agent-decision/types';
import { submitDecisionRouting } from './decision';
import { notifyDecisionSubmitted } from '@/agents/shared/notifications';
import { logHistory } from './utils';

export interface ChooseRecommendedResult {
    success?: boolean;
    routedTo?: string;
    error?: string;
}

/**
 * Choose the recommended option for a decision on the given issue.
 *
 * This is the service-layer equivalent of submitDecision({ chooseRecommended: true }).
 * Unlike submitDecision (an API handler), this function does not require a token —
 * it is only called from already-authenticated contexts (admin UI, Telegram webhook).
 */
export async function chooseRecommendedOption(
    issueNumber: number
): Promise<ChooseRecommendedResult> {
    try {
        // Initialize adapter and verify the issue is ready
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        const verification = await findDecisionItem(adapter, issueNumber);
        if (!verification.valid || !verification.itemId) {
            return { error: verification.error };
        }

        // Get decision data (DB-first, fallback to comment parsing)
        const issueDetails = await adapter.getIssueDetails(issueNumber);
        const issueTitle = issueDetails?.title || `Issue #${issueNumber}`;
        let decision = await getDecisionFromDB(issueNumber, issueTitle);

        if (!decision) {
            const comments = await adapter.getIssueComments(issueNumber);
            let decisionCommentBody = null;
            for (let i = comments.length - 1; i >= 0; i--) {
                if (isDecisionComment(comments[i].body)) {
                    decisionCommentBody = comments[i].body;
                    break;
                }
            }
            if (!decisionCommentBody) {
                return { error: 'Could not find decision comment' };
            }
            decision = parseDecision(decisionCommentBody, issueNumber, issueTitle);
        }

        if (!decision) {
            return { error: 'Could not parse decision' };
        }

        // Find recommended option
        const recommended = decision.options.find(o => o.isRecommended);
        if (!recommended) {
            return { error: 'No recommended option found' };
        }

        const selection: DecisionSelection = {
            chooseRecommended: true,
            selectedOptionId: recommended.id,
        };

        // Compute routing target
        const routing = decision.routing;
        let routedTo: string | undefined;

        if (routing) {
            const metaValue = recommended.metadata[routing.metadataKey];
            if (typeof metaValue !== 'string') {
                return { error: `Routing error: option "${recommended.id}" has no "${routing.metadataKey}" metadata` };
            }
            if (!routing.statusMap[metaValue]) {
                return { error: `Routing error: metadata value "${metaValue}" not found in routing statusMap` };
            }
            routedTo = routing.statusMap[metaValue];
        }

        // Post selection comment to GitHub (audit trail)
        const selectionComment = formatDecisionSelectionComment(selection, decision.options);
        await adapter.addIssueComment(issueNumber, selectionComment);
        console.log(`  Posted decision selection comment on issue #${issueNumber}`);

        // Save selection to DB
        await saveSelectionToDB(issueNumber, selection);

        // Route via workflow service
        await submitDecisionRouting(issueNumber, routedTo, {
            reviewStatus: routedTo ? undefined : REVIEW_STATUSES.approved,
            logAction: routedTo ? 'decision_routed' : 'decision_approved',
            logDescription: routedTo
                ? `Decision routed to ${routedTo}`
                : `Review status set to ${REVIEW_STATUSES.approved}`,
            logMetadata: { selectedOption: selection.selectedOptionId },
        });
        console.log(routedTo
            ? `  Item routed to: ${routedTo}`
            : `  Review status set to: ${REVIEW_STATUSES.approved}`);

        // Send Telegram notification (fire-and-forget)
        const itemType = decision.decisionType === 'bug-fix' ? 'bug' as const : 'feature' as const;
        await notifyDecisionSubmitted(
            issueTitle,
            issueNumber,
            recommended.title,
            routedTo,
            itemType
        ).catch(err => {
            console.error('Failed to send decision submission notification:', err);
        });

        void logHistory(issueNumber, 'choose_recommended', 'Recommended option selected', 'admin');

        return { success: true, routedTo };
    } catch (error) {
        console.error('Error choosing recommended option:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to choose recommended option',
        };
    }
}
