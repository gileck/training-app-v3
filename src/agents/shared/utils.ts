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
