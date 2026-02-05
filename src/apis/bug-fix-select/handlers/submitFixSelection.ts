/**
 * Submit Fix Selection Handler
 *
 * Posts the admin's fix selection as a GitHub comment and routes
 * the bug to the appropriate next phase.
 */

import type { SubmitFixSelectionRequest, SubmitFixSelectionResponse } from '../types';
import {
    validateBugFixToken,
    isInvestigationComment,
    parseInvestigation,
    formatFixDecisionComment,
    findBugInvestigationItem,
} from '../utils';
import { GitHubProjectsAdapter } from '@/server/project-management/adapters/github';
import { STATUSES } from '@/server/project-management/config';

/**
 * Submit fix selection for a bug.
 *
 * 1. Validates the token
 * 2. Verifies the issue is in the correct state
 * 3. Posts the decision comment
 * 4. Updates status to route to the selected destination
 * 5. Clears review status for next phase
 */
export async function submitFixSelection(
    params: SubmitFixSelectionRequest
): Promise<SubmitFixSelectionResponse> {
    const { issueNumber, token, selection } = params;

    // Validate token
    if (!validateBugFixToken(issueNumber, token)) {
        return { error: 'Invalid or expired token' };
    }

    // Validate selection
    if (!selection || !selection.selectedOptionId) {
        return { error: 'No fix option selected' };
    }

    // If custom solution, validate required fields
    if (selection.selectedOptionId === 'custom') {
        if (!selection.customSolution?.trim()) {
            return { error: 'Custom solution text is required' };
        }
        if (!selection.customDestination) {
            return { error: 'Custom destination is required' };
        }
    }

    try {
        // Initialize GitHub adapter
        const adapter = new GitHubProjectsAdapter();
        await adapter.init();

        // Verify the issue is ready
        const verification = await findBugInvestigationItem(adapter, issueNumber);
        if (!verification.valid || !verification.itemId) {
            return { error: verification.error };
        }

        // Get the investigation to extract fix options for the comment
        const comments = await adapter.getIssueComments(issueNumber);

        let investigationComment = null;
        for (let i = comments.length - 1; i >= 0; i--) {
            if (isInvestigationComment(comments[i].body)) {
                investigationComment = comments[i];
                break;
            }
        }

        if (!investigationComment) {
            return { error: 'Could not find investigation comment' };
        }

        const issueDetails = await adapter.getIssueDetails(issueNumber);
        const investigation = parseInvestigation(
            investigationComment.body,
            issueNumber,
            issueDetails?.title || `Issue #${issueNumber}`
        );

        if (!investigation) {
            return { error: 'Could not parse investigation' };
        }

        // Determine the destination
        let routedTo: 'implement' | 'tech-design';

        if (selection.selectedOptionId === 'custom') {
            routedTo = selection.customDestination!;
        } else {
            const selectedOption = investigation.fixOptions.find(
                o => o.id === selection.selectedOptionId
            );
            if (!selectedOption) {
                return { error: `Fix option ${selection.selectedOptionId} not found` };
            }
            routedTo = selectedOption.destination;
        }

        // Format and post the decision comment
        const decisionComment = formatFixDecisionComment(
            selection,
            investigation.fixOptions,
            routedTo
        );

        await adapter.addIssueComment(issueNumber, decisionComment);
        console.log(`  Posted fix selection comment on issue #${issueNumber}`);

        // Update status to route to the destination
        const newStatus = routedTo === 'implement' ? STATUSES.implementation : STATUSES.techDesign;
        await adapter.updateItemStatus(verification.itemId, newStatus);
        console.log(`  Status updated to: ${newStatus}`);

        // Clear review status for next phase
        await adapter.clearItemReviewStatus(verification.itemId);
        console.log('  Review status cleared');

        return {
            success: true,
            routedTo,
        };
    } catch (error) {
        console.error('Error submitting fix selection:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to submit fix selection',
        };
    }
}
