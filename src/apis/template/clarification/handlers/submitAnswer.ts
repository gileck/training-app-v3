/**
 * Submit Answer Handler
 *
 * Posts the user's answers as a GitHub comment and updates
 * the issue status to "Clarification Received".
 */

import type { SubmitAnswerRequest, SubmitAnswerResponse } from '../types';
import {
    validateClarificationToken,
    parseClarificationContent,
    isClarificationComment,
    extractClarificationFromComment,
    formatAnswerForGitHub,
} from '../utils';
import { getProjectManagementAdapter } from '@/server/project-management';
import { REVIEW_STATUSES } from '@/server/project-management/config';
import { verifyWaitingForClarification } from './getClarification';

/**
 * Submit answers to a clarification request.
 *
 * 1. Validates the token
 * 2. Verifies the issue is in "Waiting for Clarification" status
 * 3. Posts the answers as a GitHub comment
 * 4. Updates the status to "Clarification Received"
 */
export async function submitAnswer(
    params: SubmitAnswerRequest
): Promise<SubmitAnswerResponse> {
    const { issueNumber, token, answers } = params;

    // Validate token
    if (!validateClarificationToken(issueNumber, token)) {
        return { error: 'Invalid or expired token' };
    }

    // Validate we have answers
    if (!answers || answers.length === 0) {
        return { error: 'No answers provided' };
    }

    try {
        // Initialize adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Verify the issue is waiting for clarification
        const verification = await verifyWaitingForClarification(adapter, issueNumber);
        if (!verification.valid) {
            return { error: verification.error };
        }

        // Get the original clarification to include question context
        const comments = await adapter.getIssueComments(issueNumber);

        // Find the latest clarification comment
        let clarificationComment = null;
        for (let i = comments.length - 1; i >= 0; i--) {
            if (isClarificationComment(comments[i].body)) {
                clarificationComment = comments[i];
                break;
            }
        }

        if (!clarificationComment) {
            return { error: 'Could not find original clarification request' };
        }

        // Parse the original questions for context
        const rawContent = extractClarificationFromComment(clarificationComment.body);
        const questions = parseClarificationContent(rawContent);

        // Format the answer comment
        const answerComment = formatAnswerForGitHub(answers, questions);

        // Post the comment
        await adapter.addIssueComment(issueNumber, answerComment);
        console.log(`  Posted answer comment on issue #${issueNumber}`);

        // Update review status to "Clarification Received"
        if (adapter.hasReviewStatusField() && verification.itemId) {
            await adapter.updateItemReviewStatus(
                verification.itemId,
                REVIEW_STATUSES.clarificationReceived
            );
            console.log(`  Updated review status to: ${REVIEW_STATUSES.clarificationReceived}`);
        }

        return { success: true };
    } catch (error) {
        console.error('Error submitting answer:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to submit answer',
        };
    }
}
