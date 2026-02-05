/**
 * Get Investigation Handler
 *
 * Fetches and parses the bug investigation data from a GitHub issue.
 */

import type { GetInvestigationRequest, GetInvestigationResponse } from '../types';
import {
    validateBugFixToken,
    isInvestigationComment,
    parseInvestigation,
    findBugInvestigationItem,
} from '../utils';
import { GitHubProjectsAdapter } from '@/server/project-management/adapters/github';

/**
 * Get investigation data for a bug issue.
 *
 * 1. Validates the token
 * 2. Verifies the issue is in the correct state
 * 3. Parses the investigation comment
 */
export async function getInvestigation(
    params: GetInvestigationRequest
): Promise<GetInvestigationResponse> {
    const { issueNumber, token } = params;

    // Validate token
    if (!validateBugFixToken(issueNumber, token)) {
        return { error: 'Invalid or expired token' };
    }

    try {
        // Initialize GitHub adapter
        const adapter = new GitHubProjectsAdapter();
        await adapter.init();

        // Verify the issue is ready for fix selection
        const verification = await findBugInvestigationItem(adapter, issueNumber);
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

        // Find the latest investigation comment
        let investigationComment = null;
        for (let i = comments.length - 1; i >= 0; i--) {
            if (isInvestigationComment(comments[i].body)) {
                investigationComment = comments[i];
                break;
            }
        }

        if (!investigationComment) {
            return { error: 'No bug investigation found on this issue' };
        }

        // Parse the investigation
        const investigation = parseInvestigation(
            investigationComment.body,
            issueNumber,
            issueDetails.title
        );

        if (!investigation) {
            return { error: 'Could not parse investigation data' };
        }

        return { investigation };
    } catch (error) {
        console.error('Error getting investigation:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to get investigation',
        };
    }
}
