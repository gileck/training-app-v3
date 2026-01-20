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
    options: CommonCLIOptions
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

    await adapter.addIssueComment(issueNumber, comment);
    console.log('  Comment added with clarification request');

    // Set review status
    if (adapter.hasReviewStatusField()) {
        await adapter.updateItemReviewStatus(item.id, REVIEW_STATUSES.waitingForClarification);
        console.log(`  Review Status updated to: ${REVIEW_STATUSES.waitingForClarification}`);
    }

    // Send notification
    await notifyAgentNeedsClarification(phase, title, issueNumber, clarificationRequest, issueType);
    console.log('  Notification sent');

    return { success: true, needsClarification: true };
}
