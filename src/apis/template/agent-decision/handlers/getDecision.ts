/**
 * Get Decision Handler
 *
 * Fetches and parses the agent decision data from a GitHub issue.
 */

import type { GetDecisionRequest, GetDecisionResponse } from '../types';
import {
    validateDecisionToken,
    isDecisionComment,
    parseDecision,
    findDecisionItem,
} from '../utils';
import { getProjectManagementAdapter } from '@/server/project-management';

/**
 * Get decision data for an issue.
 *
 * 1. Validates the token
 * 2. Verifies the issue is in Waiting for Review state
 * 3. Parses the decision comment
 */
export async function getDecision(
    params: GetDecisionRequest
): Promise<GetDecisionResponse> {
    const { issueNumber, token } = params;

    // Validate token
    if (!validateDecisionToken(issueNumber, token)) {
        return { error: 'Invalid or expired token' };
    }

    try {
        // Initialize adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Verify the issue is ready for decision selection
        const verification = await findDecisionItem(adapter, issueNumber);
        if (!verification.valid) {
            return { error: verification.error };
        }

        // Get issue details
        const issueDetails = await adapter.getIssueDetails(issueNumber);
        if (!issueDetails) {
            return { error: `Could not fetch issue #${issueNumber}` };
        }

        // Get issue comments
        const comments = await adapter.getIssueComments(issueNumber);

        // Find the latest decision comment
        let decisionComment = null;
        for (let i = comments.length - 1; i >= 0; i--) {
            if (isDecisionComment(comments[i].body)) {
                decisionComment = comments[i];
                break;
            }
        }

        if (!decisionComment) {
            return { error: 'No agent decision found on this issue' };
        }

        // Parse the decision
        const decision = parseDecision(
            decisionComment.body,
            issueNumber,
            issueDetails.title
        );

        if (!decision) {
            return { error: 'Could not parse decision data' };
        }

        return { decision };
    } catch (error) {
        console.error('Error getting decision:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to get decision',
        };
    }
}
