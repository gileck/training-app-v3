/**
 * Shared utility functions for agents
 */

import { reports } from '@/server/database';
import type {
    SessionLogEntry,
    ReportBrowserInfo,
    PerformanceEntryData,
    BugCategory,
} from '@/server/database/collections/reports/types';
import { REVIEW_STATUSES } from '@/server/project-management/config';
import type { ProjectManagementAdapter } from '@/server/project-management/types';
import type { CommonCLIOptions } from './types';
import { notifyAgentNeedsClarification } from './notifications';
import { addAgentPrefix, type AgentName } from './agent-identity';
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { hostname } from 'os';

// ============================================================
// TYPE DETECTION
// ============================================================

/**
 * Detect if issue is a bug or feature based on labels
 */
export function getIssueType(labels?: string[]): 'bug' | 'feature' {
    if (!labels) return 'feature';
    return labels.includes('bug') ? 'bug' : 'feature';
}

// ============================================================
// BUG DIAGNOSTICS
// ============================================================

/**
 * Bug diagnostic data extracted from report
 */
export interface BugDiagnostics {
    category?: BugCategory;
    sessionLogs?: SessionLogEntry[];
    browserInfo?: ReportBrowserInfo;
    stackTrace?: string;
    errorMessage?: string;
    performanceEntries?: PerformanceEntryData[];
    route?: string;
    networkStatus?: 'online' | 'offline';
}

/**
 * Get bug diagnostic data if issue is linked to a bug report
 * Returns null if not a bug or no diagnostics available
 */
export async function getBugDiagnostics(issueNumber: number): Promise<BugDiagnostics | null> {
    try {
        // Query MongoDB reports collection by githubIssueNumber
        const report = await reports.findByGitHubIssueNumber(issueNumber);
        if (!report || report.type !== 'bug') {
            return null;
        }

        return {
            category: report.category,
            sessionLogs: report.sessionLogs,
            browserInfo: report.browserInfo,
            stackTrace: report.stackTrace,
            errorMessage: report.errorMessage,
            performanceEntries: report.performanceEntries,
            route: report.route,
            networkStatus: report.networkStatus,
        };
    } catch (error) {
        console.error('Error fetching bug diagnostics:', error);
        return null;
    }
}

/**
 * Format session logs for inclusion in prompts
 */
export function formatSessionLogs(logs: SessionLogEntry[], limit?: number): string {
    const logsToFormat = limit ? logs.slice(-limit) : logs;

    return logsToFormat
        .map((log) => {
            const time = new Date(log.timestamp).toISOString();
            const emoji = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : 'ℹ️';
            const meta = log.meta ? ` | ${JSON.stringify(log.meta)}` : '';
            return `${emoji} [${time}] [${log.level}] ${log.feature}: ${log.message}${meta}`;
        })
        .join('\n');
}

// ============================================================
// CLARIFICATION EXTRACTION
// ============================================================

/**
 * Extract clarification request from agent output
 *
 * Agents output clarification requests in this format:
 * ```clarification
 * [formatted question with context, options, recommendation]
 * ```
 */
export function extractClarification(content: string): string | null {
    const match = content.match(/```clarification\n([\s\S]*?)\n```/);
    return match ? match[1].trim() : null;
}

/**
 * Handle agent clarification request
 */
export async function handleClarificationRequest(
    adapter: ProjectManagementAdapter,
    item: { id: string; content: { number: number; title: string; labels?: string[] } },
    issueNumber: number,
    clarificationRequest: string,
    phase: string,
    title: string,
    issueType: 'bug' | 'feature',
    options: CommonCLIOptions,
    agentName: AgentName
): Promise<{ success: boolean; needsClarification: true }> {

    if (options.dryRun) {
        console.log('  [DRY RUN] Would add clarification comment');
        console.log('  [DRY RUN] Would set Review Status to Waiting for Clarification');
        console.log('  [DRY RUN] Would send notification');
        console.log(`\n--- Clarification Request ---\n${clarificationRequest}\n---\n`);
        return { success: true, needsClarification: true };
    }

    // Add formatted comment to GitHub issue
    const comment = [
        '## 🤔 Agent Needs Clarification',
        '',
        clarificationRequest,
        '',
        '---',
        '_Please respond with your answer in a comment below, then click "Clarification Received" in Telegram._',
    ].join('\n');

    const prefixedComment = addAgentPrefix(agentName, comment);
    await adapter.addIssueComment(issueNumber, prefixedComment);
    console.log('  Comment added with clarification request');

    // Set review status
    if (adapter.hasReviewStatusField()) {
        // Verify "Waiting for Clarification" status exists
        const availableStatuses = await adapter.getAvailableReviewStatuses();
        if (!availableStatuses.includes(REVIEW_STATUSES.waitingForClarification)) {
            console.error('  ❌ ERROR: "Waiting for Clarification" status not available in project');
            console.error('  Add this status to your GitHub Project Review Status field to enable clarification flow');
            console.error('  Item will be skipped to prevent re-processing loop');
            console.error('  Run: yarn verify-setup');
            return { success: false, needsClarification: true };
        }

        await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForClarification);
        console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForClarification}`);
    }

    // Send notification
    await notifyAgentNeedsClarification(phase, title, issueNumber, clarificationRequest, issueType);
    console.log('  Notification sent');

    return { success: true, needsClarification: true };
}

// ============================================================
// FEEDBACK RESOLUTION
// ============================================================

/**
 * Feedback resolution item (original feedback and how it was addressed)
 */
export interface FeedbackResolution {
    number: number;
    original: string;
    resolution: string;
}

/**
 * Extract feedback resolution from agent output
 */
export function extractFeedbackResolution(text: string): FeedbackResolution[] | null {
    if (!text) return null;

    try {
        // Look for ```feedback-resolution ... ``` pattern
        const blockMatch = text.match(/```feedback-resolution\s*([\s\S]*?)\s*```/);
        if (!blockMatch?.[1]) {
            return null;
        }

        const content = blockMatch[1].trim();
        const resolutions: FeedbackResolution[] = [];

        // Parse numbered items: "1. [original] → [resolution]"
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(/^(\d+)\.\s*(.+?)\s*→\s*(.+)$/);
            if (match) {
                resolutions.push({
                    number: parseInt(match[1], 10),
                    original: match[2].trim(),
                    resolution: match[3].trim(),
                });
            }
        }

        return resolutions.length > 0 ? resolutions : null;
    } catch (error) {
        console.error('  Failed to parse feedback resolution:', error);
        return null;
    }
}

/**
 * Format feedback resolution as a markdown table for PR comment
 */
export function formatFeedbackResolution(resolutions: FeedbackResolution[]): string {
    if (resolutions.length === 0) {
        return 'Addressed review feedback. Ready for re-review.';
    }

    const rows = resolutions.map((r) => {
        return `| ${r.number} | ${r.original} | ${r.resolution} |`;
    });

    return `## Feedback Addressed

| # | Original Feedback | Resolution |
|---|------------------|------------|
${rows.join('\n')}

Ready for re-review.`;
}

// ============================================================
// PR SUMMARY EXTRACTION
// ============================================================

/**
 * Extract PR summary from agent output
 *
 * Agents output PR summaries in this format:
 * ```pr-summary
 * ## Summary
 * [bullet points]
 *
 * ## Changes
 * - **file**: description
 * ```
 */
export function extractPRSummary(content: string): string | null {
    if (!content) return null;

    const match = content.match(/```pr-summary\n([\s\S]*?)\n```/);
    return match ? match[1].trim() : null;
}

// ============================================================
// CONCURRENT PROCESSING LOCK
// ============================================================

/**
 * Lock file content structure
 */
interface LockFileContent {
    pid: number;
    agentName: string;
    startTime: string;
    hostname: string;
}

// Store current process's lock info for verification
const currentLocks = new Map<string, LockFileContent>();

/**
 * Acquire a lock for an agent to prevent concurrent processing.
 *
 * Features:
 * - Stores PID for ownership verification
 * - 10-minute stale lock timeout (shorter than before for better crash recovery)
 * - Checks if owning process is still alive
 * - Graceful shutdown handlers registered automatically
 *
 * @returns true if lock acquired, false if another instance is running
 */
export function acquireAgentLock(agentName: string): boolean {
    const lockFile = `/tmp/agent-${agentName}.lock`;

    if (existsSync(lockFile)) {
        try {
            // Read existing lock content
            const content = readFileSync(lockFile, 'utf-8');
            let lockInfo: LockFileContent;

            try {
                lockInfo = JSON.parse(content);
            } catch {
                // Invalid JSON - treat as stale
                console.warn(`⚠️  Invalid lock file found - removing`);
                unlinkSync(lockFile);
                // Continue to acquire lock below
                return acquireLockFile(lockFile, agentName);
            }

            // Check if the process that holds the lock is still alive
            if (lockInfo.pid && isProcessAlive(lockInfo.pid)) {
                // Process is alive - lock is valid
                const lockTime = new Date(lockInfo.startTime);
                const ageMinutes = (Date.now() - lockTime.getTime()) / 60000;

                console.warn(`⚠️  Another ${agentName} agent is running (PID: ${lockInfo.pid}, started ${ageMinutes.toFixed(1)} minutes ago)`);
                console.warn(`   Wait for it to finish, or if it's stuck, kill it: kill ${lockInfo.pid}`);
                console.warn(`   Or manually remove the lock: rm ${lockFile}`);
                return false;
            }

            // Process is dead - this is a stale lock from a crash
            console.warn(`⚠️  Found stale lock from crashed process (PID: ${lockInfo.pid} is no longer running)`);
            console.warn(`   Removing stale lock and continuing...`);
            unlinkSync(lockFile);

        } catch (error) {
            // Can't read lock file - try to remove it
            console.warn(`⚠️  Error reading lock file: ${error instanceof Error ? error.message : 'unknown'}`);
            try {
                unlinkSync(lockFile);
            } catch {
                // If we can't delete either, fail
                console.error(`❌  Cannot acquire lock - unable to read or delete ${lockFile}`);
                return false;
            }
        }
    }

    return acquireLockFile(lockFile, agentName);
}

/**
 * Actually create the lock file with process info
 */
function acquireLockFile(lockFile: string, agentName: string): boolean {
    const lockInfo: LockFileContent = {
        pid: process.pid,
        agentName,
        startTime: new Date().toISOString(),
        hostname: hostname(),
    };

    try {
        // Write lock file
        writeFileSync(lockFile, JSON.stringify(lockInfo, null, 2));

        // Store in memory for verification
        currentLocks.set(agentName, lockInfo);

        // Register cleanup handlers (only once per process)
        registerCleanupHandlers(agentName);

        console.log(`🔒 Lock acquired for ${agentName} (PID: ${process.pid})`);
        return true;
    } catch (error) {
        console.error(`❌  Failed to create lock file: ${error instanceof Error ? error.message : 'unknown'}`);
        return false;
    }
}

/**
 * Check if a process is still running
 */
function isProcessAlive(pid: number): boolean {
    try {
        // Sending signal 0 checks if process exists without killing it
        process.kill(pid, 0);
        return true;
    } catch {
        // Process doesn't exist or we don't have permission (assume dead)
        return false;
    }
}

// Track if cleanup handlers are registered
let cleanupHandlersRegistered = false;

/**
 * Register cleanup handlers for graceful shutdown
 */
function registerCleanupHandlers(_agentName: string): void {
    if (cleanupHandlersRegistered) return;
    cleanupHandlersRegistered = true;

    const cleanup = () => {
        // Release all locks held by this process
        for (const name of currentLocks.keys()) {
            releaseAgentLock(name);
        }
    };

    // Handle graceful shutdown
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
        console.log('\n🛑 Interrupted - cleaning up...');
        cleanup();
        process.exit(130); // Standard exit code for SIGINT
    });
    process.on('SIGTERM', () => {
        console.log('\n🛑 Terminated - cleaning up...');
        cleanup();
        process.exit(143); // Standard exit code for SIGTERM
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught exception:', error);
        cleanup();
        process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
        console.error('❌ Unhandled rejection:', reason);
        cleanup();
        process.exit(1);
    });
}

/**
 * Release the lock for an agent.
 * Only releases if this process owns the lock.
 */
export function releaseAgentLock(agentName: string): void {
    const lockFile = `/tmp/agent-${agentName}.lock`;

    // Check if we own this lock
    const ourLock = currentLocks.get(agentName);
    if (!ourLock) {
        // We don't think we own this lock
        return;
    }

    if (existsSync(lockFile)) {
        try {
            // Verify we still own the lock before deleting
            const content = readFileSync(lockFile, 'utf-8');
            const lockInfo = JSON.parse(content) as LockFileContent;

            if (lockInfo.pid === process.pid) {
                unlinkSync(lockFile);
                currentLocks.delete(agentName);
                console.log(`🔓 Lock released for ${agentName}`);
            } else {
                // Someone else's lock - don't delete!
                console.warn(`⚠️  Lock file owned by different process (PID: ${lockInfo.pid}) - not releasing`);
            }
        } catch {
            // Best effort cleanup
            try {
                unlinkSync(lockFile);
                currentLocks.delete(agentName);
            } catch {
                // Ignore
            }
        }
    }

    currentLocks.delete(agentName);
}

/**
 * Check if we currently hold a lock
 */
export function hasAgentLock(agentName: string): boolean {
    return currentLocks.has(agentName);
}
