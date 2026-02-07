/**
 * Submit Decision Handler
 *
 * Posts the admin's decision selection as a GitHub comment.
 * If the decision comment includes a routing config, automatically
 * routes the item to the target status. Otherwise sets review
 * status to Approved for the agent to pick up.
 */

import type { SubmitDecisionRequest, SubmitDecisionResponse } from '../types';
import {
    validateDecisionToken,
    isDecisionComment,
    parseDecision,
    formatDecisionSelectionComment,
    findDecisionItem,
} from '../utils';
import { getProjectManagementAdapter } from '@/server/project-management';
import { REVIEW_STATUSES } from '@/server/project-management/config';

/**
 * Submit a decision selection.
 *
 * 1. Validates the token
 * 2. Verifies the issue is in the correct state
 * 3. Posts the selection comment (with machine-readable marker)
 * 4. If routing config exists: routes item to target status
 * 5. Otherwise: sets review status to Approved
 */
export async function submitDecision(
    params: SubmitDecisionRequest
): Promise<SubmitDecisionResponse> {
    const { issueNumber, token, selection } = params;

    // Validate token
    if (!validateDecisionToken(issueNumber, token)) {
        return { error: 'Invalid or expired token' };
    }

    // Validate selection
    if (!selection || !selection.selectedOptionId) {
        return { error: 'No option selected' };
    }

    // If custom solution, validate required fields
    if (selection.selectedOptionId === 'custom') {
        if (!selection.customSolution?.trim()) {
            return { error: 'Custom solution text is required' };
        }
    }

    try {
        // Initialize adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Verify the issue is ready
        const verification = await findDecisionItem(adapter, issueNumber);
        if (!verification.valid || !verification.itemId) {
            return { error: verification.error };
        }

        // Get the decision comment to extract options for the selection comment
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

        const issueDetails = await adapter.getIssueDetails(issueNumber);
        const decision = parseDecision(
            decisionCommentBody,
            issueNumber,
            issueDetails?.title || `Issue #${issueNumber}`
        );

        if (!decision) {
            return { error: 'Could not parse decision' };
        }

        // Validate selected option exists (unless custom)
        let selectedOption = null;
        if (selection.selectedOptionId !== 'custom') {
            selectedOption = decision.options.find(
                o => o.id === selection.selectedOptionId
            );
            if (!selectedOption) {
                return { error: `Option ${selection.selectedOptionId} not found` };
            }
        }

        // Format and post the selection comment
        const selectionComment = formatDecisionSelectionComment(
            selection,
            decision.options
        );

        await adapter.addIssueComment(issueNumber, selectionComment);
        console.log(`  Posted decision selection comment on issue #${issueNumber}`);

        // Resolve routing if config is present
        const routing = decision.routing;
        let routedTo: string | undefined;

        if (routing) {
            // Routing config is present — routing MUST succeed or we fail
            if (selection.selectedOptionId === 'custom') {
                if (!routing.customDestinationStatusMap) {
                    return { error: `Routing error: custom destination options are configured but no customDestinationStatusMap in routing config` };
                }
                const dest = selection.customDestination;
                if (!dest) {
                    return { error: `Routing error: custom solution selected but no destination chosen` };
                }
                if (!routing.customDestinationStatusMap[dest]) {
                    return { error: `Routing error: custom destination "${dest}" not found in routing config` };
                }
                routedTo = routing.customDestinationStatusMap[dest];
            } else if (selectedOption) {
                const metaValue = selectedOption.metadata[routing.metadataKey];
                if (typeof metaValue !== 'string') {
                    return { error: `Routing error: option "${selectedOption.id}" has no "${routing.metadataKey}" metadata` };
                }
                if (!routing.statusMap[metaValue]) {
                    return { error: `Routing error: metadata value "${metaValue}" not found in routing statusMap` };
                }
                routedTo = routing.statusMap[metaValue];
            }

            // Route item to target status and clear review status
            await adapter.updateItemStatus(verification.itemId, routedTo!);
            console.log(`  Item routed to: ${routedTo}`);

            if (adapter.hasReviewStatusField()) {
                await adapter.updateItemReviewStatus(verification.itemId, '');
                console.log(`  Review status cleared`);
            }
        } else {
            // No routing config — set review status to Approved for agent to pick up
            if (adapter.hasReviewStatusField()) {
                await adapter.updateItemReviewStatus(verification.itemId, REVIEW_STATUSES.approved);
                console.log(`  Review status set to: ${REVIEW_STATUSES.approved}`);
            }
        }

        return { success: true, routedTo };
    } catch (error) {
        console.error('Error submitting decision:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to submit decision',
        };
    }
}
