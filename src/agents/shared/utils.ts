/**
 * Shared utility functions for agents
 */

import { reports } from '@/server/database';
import type {
    SessionLogEntry,
    ReportBrowserInfo,
    PerformanceEntryData,
    BugCategory,
} from '@/server/database/collections/template/reports/types';
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

import type { StructuredClarification } from './output-schemas';

/**
 * Result of extracting clarification from agent output.
 * Contains structured clarification data.
 */
export interface ExtractedClarification {
    /** Structured clarification data */
    structured: StructuredClarification;
}

/**
 * Extract clarification request from agent result
 *
 * Checks for structured clarification data in the agent's output.
 * Throws an error if agent uses legacy string format - agents must use structured format.
 *
 * @param result - The agent result object containing content and/or structuredOutput
 * @returns ExtractedClarification with structured data, or null if no clarification needed
 * @throws Error if agent uses legacy string format instead of structured clarification
 */
export function extractClarificationFromResult(result: {
    content?: string | null;
    structuredOutput?: unknown;
}): ExtractedClarification | null {
    if (!result.structuredOutput || typeof result.structuredOutput !== 'object') {
        return null;
    }

    const output = result.structuredOutput as Record<string, unknown>;

    // Check explicit needsClarification flag
    if (output.needsClarification !== true) {
        return null;
    }

    // Check for structured clarification format (required)
    if (output.clarification && typeof output.clarification === 'object') {
        const clarification = output.clarification as Record<string, unknown>;

        // Validate required fields
        if (
            typeof clarification.context === 'string' &&
            typeof clarification.question === 'string' &&
            Array.isArray(clarification.options) &&
            clarification.options.length > 0 &&
            typeof clarification.recommendation === 'string'
        ) {
            return {
                structured: clarification as unknown as StructuredClarification,
            };
        }

        // Clarification object exists but is invalid
        throw new Error(
            'Invalid clarification format: clarification object must have context, question, options (non-empty array), and recommendation fields'
        );
    }

    // Legacy string format - not supported
    if (typeof output.clarificationRequest === 'string' && output.clarificationRequest.trim()) {
        throw new Error(
            'Legacy clarificationRequest string format is not supported. Use structured clarification object instead: { clarification: { context, question, options, recommendation } }'
        );
    }

    // needsClarification is true but no clarification data
    throw new Error(
        'needsClarification is true but no clarification object provided. Add: clarification: { context, question, options, recommendation }'
    );
}

/**
 * Format structured clarification as markdown for GitHub comments.
 * This produces a consistent, parseable format for the clarification UI.
 */
export function formatStructuredClarification(clarification: StructuredClarification): string {
    const lines: string[] = [];

    // Context section
    lines.push('## Context');
    lines.push(clarification.context);
    lines.push('');

    // Question section
    lines.push('## Question');
    lines.push(clarification.question);
    lines.push('');

    // Options section
    lines.push('## Options');
    lines.push('');

    clarification.options.forEach((option, index) => {
        const emoji = option.isRecommended ? '✅' : '⚠️';
        lines.push(`${emoji} Option ${index + 1}: ${option.label}`);
        // Add description with proper indentation
        const descriptionLines = option.description.split('\n');
        descriptionLines.forEach(line => {
            lines.push(`   ${line}`);
        });
        lines.push('');
    });

    // Recommendation section
    lines.push('## Recommendation');
    lines.push(clarification.recommendation);

    return lines.join('\n');
}

/**
 * Get the text content from extracted clarification (for display/notifications).
 * Returns formatted markdown from structured clarification data.
 */
export function getClarificationText(extracted: ExtractedClarification): string {
    return formatStructuredClarification(extracted.structured);
}

/**
 * Handle agent clarification request.
 *
 * Accepts ExtractedClarification with structured data.
 * Formats and posts the clarification to GitHub, updates status, and sends notification.
 */
export async function handleClarificationRequest(
    adapter: ProjectManagementAdapter,
    item: { id: string; content: { number: number; title: string; labels?: string[] } },
    issueNumber: number,
    clarification: ExtractedClarification,
    phase: string,
    title: string,
    issueType: 'bug' | 'feature',
    options: CommonCLIOptions,
    agentName: AgentName
): Promise<{ success: boolean; needsClarification: true }> {
    // Get the text content for display
    const clarificationText = getClarificationText(clarification);

    if (options.dryRun) {
        console.log('  [DRY RUN] Would add clarification comment');
        console.log('  [DRY RUN] Would set Review Status to Waiting for Clarification');
        console.log('  [DRY RUN] Would send notification');
        console.log(`\n--- Clarification Request ---\n${clarificationText}\n---\n`);
        return { success: true, needsClarification: true };
    }

    // Add formatted comment to GitHub issue
    const comment = [
        '## 🤔 Agent Needs Clarification',
        '',
        clarificationText,
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
    await notifyAgentNeedsClarification(phase, title, issueNumber, clarificationText, issueType);
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

