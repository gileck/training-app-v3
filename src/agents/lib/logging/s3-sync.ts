/**
 * S3 Log Sync to Repository
 *
 * When a workflow completes (status → Done), this module syncs the S3 log
 * to the repository via GitHub API and deletes the S3 file.
 */

import { getProjectManagementAdapter } from '@/server/project-management';
import { isS3LoggingEnabled, s3ReadLog, s3DeleteLog, getS3LogKey } from './s3-writer';

/**
 * Sync a log file from S3 to the repository via GitHub API
 *
 * @param issueNumber - The issue number for the log file
 * @returns true if sync was successful, false if skipped (no S3 logging or file doesn't exist)
 */
export async function syncLogToRepo(issueNumber: number): Promise<boolean> {
    if (!isS3LoggingEnabled()) {
        console.log(`  [LOG:S3_SYNC] S3 logging not enabled, skipping sync for issue #${issueNumber}`);
        return false;
    }

    try {
        // Read log content from S3
        const content = await s3ReadLog(issueNumber);

        if (!content) {
            console.log(`  [LOG:S3_SYNC] No log found in S3 for issue #${issueNumber}`);
            return false;
        }

        // Get the GitHub adapter and commit the file
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        const filePath = `agent-logs/issue-${issueNumber}.md`;
        const commitMessage = `docs: sync agent log for issue #${issueNumber}

Auto-synced from S3 on workflow completion.

Co-Authored-By: Agent Workflow <noreply@anthropic.com>`;

        await adapter.createOrUpdateFileContents(filePath, content, commitMessage);

        console.log(`  [LOG:S3_SYNC] Successfully synced log to repo: ${filePath}`);
        return true;
    } catch (error) {
        console.error(`  [LOG:S3_SYNC] Failed to sync log for issue #${issueNumber}:`, error);
        throw error;
    }
}

/**
 * Sync a log file from S3 to the repository and then delete the S3 file
 *
 * This should be called when a workflow completes (status → Done).
 *
 * @param issueNumber - The issue number for the log file
 * @returns true if sync and cleanup was successful, false if skipped
 */
export async function syncLogToRepoAndCleanup(issueNumber: number): Promise<boolean> {
    if (!isS3LoggingEnabled()) {
        return false;
    }

    try {
        // First sync to repo
        const synced = await syncLogToRepo(issueNumber);

        if (!synced) {
            return false;
        }

        // Then delete from S3
        await s3DeleteLog(issueNumber);
        console.log(`  [LOG:S3_SYNC] Deleted S3 log for issue #${issueNumber}`);

        return true;
    } catch (error) {
        // Log but don't throw - sync failure shouldn't break the workflow
        console.error(`  [LOG:S3_SYNC] Error during sync/cleanup for issue #${issueNumber}:`, error);
        return false;
    }
}

/**
 * Check if an S3 log exists and get its key
 * Useful for debugging and verification
 */
export function getS3LogInfo(issueNumber: number): { enabled: boolean; key: string } {
    return {
        enabled: isS3LoggingEnabled(),
        key: getS3LogKey(issueNumber),
    };
}
