/**
 * Get Clarification Handler
 *
 * Fetches and parses clarification data for a GitHub issue.
 * Validates the security token before returning data.
 */

import type { GetClarificationRequest, GetClarificationResponse } from '../types';
import {
    validateClarificationToken,
    parseClarificationContent,
    isClarificationComment,
    extractClarificationFromComment,
} from '../utils';
import { getProjectManagementAdapter } from '@/server/project-management';
import type { ProjectManagementAdapter } from '@/server/project-management';
import { REVIEW_STATUSES } from '@/server/project-management/config';

/**
 * Get clarification data for an issue.
 *
 * Validates the token, fetches the issue comments, finds the latest
 * clarification comment, and parses it into structured questions.
 */
export async function getClarification(
    params: GetClarificationRequest
): Promise<GetClarificationResponse> {
    const { issueNumber, token } = params;

    // Validate token
    if (!validateClarificationToken(issueNumber, token)) {
        return { error: 'Invalid or expired token' };
    }

    try {
        // Initialize adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Get issue details
        const issueDetails = await adapter.getIssueDetails(issueNumber);
        if (!issueDetails) {
            return { error: `Issue #${issueNumber} not found` };
        }

        // Get all comments on the issue
        const comments = await adapter.getIssueComments(issueNumber);

        // Find the latest clarification comment (search from newest to oldest)
        let clarificationComment = null;
        for (let i = comments.length - 1; i >= 0; i--) {
            if (isClarificationComment(comments[i].body)) {
                clarificationComment = comments[i];
                break;
            }
        }

        if (!clarificationComment) {
            return { error: 'No clarification request found for this issue' };
        }

        // Extract and parse the clarification content
        const rawContent = extractClarificationFromComment(clarificationComment.body);
        const questions = parseClarificationContent(rawContent);

        if (questions.length === 0) {
            // Return raw content for fallback display
            return {
                clarification: {
                    issueNumber,
                    issueTitle: issueDetails.title,
                    questions: [],
                    rawContent,
                },
            };
        }

        return {
            clarification: {
                issueNumber,
                issueTitle: issueDetails.title,
                questions,
                rawContent,
            },
        };
    } catch (error) {
        console.error('Error fetching clarification:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to fetch clarification',
        };
    }
}

/**
 * Verify that the issue is in "Waiting for Clarification" status.
 * This is used by submitAnswer to ensure we're answering the right issue.
 */
export async function verifyWaitingForClarification(
    adapter: ProjectManagementAdapter,
    issueNumber: number
): Promise<{ valid: boolean; itemId?: string; error?: string }> {
    // List items to find this issue
    const items = await adapter.listItems();

    const item = items.find(
        i => i.content?.type === 'Issue' && i.content.number === issueNumber
    );

    if (!item) {
        return { valid: false, error: 'Issue not found in project board' };
    }

    // Check review status
    if (item.reviewStatus !== REVIEW_STATUSES.waitingForClarification) {
        return {
            valid: false,
            error: `Issue is not waiting for clarification (current status: ${item.reviewStatus || 'none'})`,
        };
    }

    return { valid: true, itemId: item.id };
}
