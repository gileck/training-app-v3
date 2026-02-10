/**
 * Workflow Service — Merge Final PR
 *
 * Merges the final PR from feature branch to main in a multi-phase workflow.
 * Handles cleanup of branches, marking as done, and completion comment.
 * Extracted from Telegram handler so both Telegram and UI
 * share the same code path.
 */

import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExists,
} from '@/agents/lib/logging';
import {
    getTaskBranch,
} from '@/agents/lib';
import { getArtifactsFromIssue, clearTaskBranchFromDB } from '@/agents/lib/workflow-db';
import { clearTaskBranch } from '@/agents/lib';
import { getInitializedAdapter } from './utils';
import { markDone } from './advance';
import type { ServiceResult } from './types';

export interface MergeFinalPRResult extends ServiceResult {
    mergeCommitSha?: string;
}

/**
 * Merge the final PR from feature branch to main.
 *
 * 1. Merges the PR (handles already-merged)
 * 2. Marks as Done (status, review, source doc, log sync)
 * 3. Cleans up branches (task branch + all phase branches)
 * 4. Clears task branch from artifact
 * 5. Posts completion comment
 */
export async function mergeFinalPR(
    issueNumber: number,
    prNumber: number
): Promise<MergeFinalPRResult> {
    const adapter = await getInitializedAdapter();

    if (logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Final Review Merge', 'webhook');
    }

    // Get PR info for commit message
    const prInfo = await adapter.getPRInfo(prNumber);
    if (!prInfo) {
        return { success: false, error: 'Could not fetch PR info' };
    }

    const commitTitle = prInfo.title;
    const commitBody = `Closes #${issueNumber}\n\nFeature branch workflow - final merge to main.`;

    // Merge PR
    let mergeCommitSha: string | null = null;
    try {
        mergeCommitSha = await adapter.mergePullRequest(prNumber, commitTitle, commitBody);
        if (logExists(issueNumber)) {
            logWebhookAction(issueNumber, 'final_pr_merged', `Final PR #${prNumber} merged to main`, {
                prNumber,
                commitTitle,
                mergeCommitSha,
            });
        }
    } catch (mergeError) {
        const errorMsg = mergeError instanceof Error ? mergeError.message : String(mergeError);
        if (errorMsg.includes('already been merged') || errorMsg.includes('not open')) {
            mergeCommitSha = await adapter.getMergeCommitSha(prNumber);
        } else {
            throw mergeError;
        }
    }

    // Mark as Done
    await markDone(issueNumber, {
        logAction: 'status_done',
        logDescription: 'Final PR merged, issue marked as Done',
        logMetadata: { prNumber },
    });

    // Clean up branches
    const artifact = await getArtifactsFromIssue(adapter, issueNumber);
    const taskBranch = getTaskBranch(artifact);

    if (taskBranch) {
        try {
            await adapter.deleteBranch(taskBranch);
            if (logExists(issueNumber)) {
                logWebhookAction(issueNumber, 'branch_deleted', `Deleted feature branch: ${taskBranch}`, {
                    branch: taskBranch,
                });
            }
        } catch {
            // Branch already deleted
        }
    }

    // Delete phase branches
    const totalPhases = artifact?.implementation?.phases?.length || 0;
    for (let i = 1; i <= totalPhases; i++) {
        const phaseBranch = `feature/task-${issueNumber}-phase-${i}`;
        try {
            await adapter.deleteBranch(phaseBranch);
        } catch {
            // Branch doesn't exist
        }
    }

    // Clear task branch from artifact
    try {
        await clearTaskBranchFromDB(issueNumber);
        await clearTaskBranch(adapter, issueNumber);
    } catch (artifactError) {
        console.warn('Failed to clear task branch from artifact:', artifactError);
    }

    // Post completion comment
    const completionComment = `🎉 **Feature Complete!**\n\nFinal PR #${prNumber} has been merged to main.\nAll phases have been successfully integrated.`;
    await adapter.addIssueComment(issueNumber, completionComment);

    if (logExists(issueNumber)) {
        logWebhookPhaseEnd(issueNumber, 'Final Review Merge', 'success', 'webhook');
    }

    return {
        success: true,
        mergeCommitSha: mergeCommitSha || undefined,
    };
}
