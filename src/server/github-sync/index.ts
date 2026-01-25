/**
 * GitHub Sync Service
 *
 * Server-side service for syncing feature requests to GitHub.
 * Used by both the API (approve action) and CLI (batch sync).
 */

import { featureRequests, reports } from '@/server/database';
import type { FeatureRequestDocument } from '@/server/database/collections/feature-requests/types';
import type { ReportDocument } from '@/server/database/collections/reports/types';
import {
    sendFeatureRoutingNotification,
    sendBugRoutingNotification,
} from '@/server/telegram';
import { getProjectManagementAdapter, STATUSES } from '@/server/project-management';
import { ensureArtifactComment } from '@/agents/lib';

// ============================================================
// HELPERS
// ============================================================

function buildIssueBody(request: FeatureRequestDocument): string {
    const sections: string[] = [];

    sections.push(`## Description\n\n${request.description}`);

    if (request.page) {
        sections.push(`## Related Page/Area\n\n${request.page}`);
    }

    if (request.priority) {
        const priorityEmojis: Record<string, string> = {
            low: ':small_blue_diamond:',
            medium: ':small_orange_diamond:',
            high: ':large_orange_diamond:',
            critical: ':red_circle:',
        };
        sections.push(`## Priority\n\n${priorityEmojis[request.priority] || ''} ${request.priority.toUpperCase()}`);
    }

    sections.push(`---\n\n_Synced from feature request \`${request._id}\`_`);

    return sections.join('\n\n');
}

function getLabels(request: FeatureRequestDocument): string[] {
    const labels: string[] = ['feature-request'];
    if (request.priority) {
        labels.push(`priority:${request.priority}`);
    }
    return labels;
}

function buildBugIssueBody(report: ReportDocument): string {
    const sections: string[] = [];

    if (report.description) {
        sections.push(`## Description\n\n${report.description}`);
    }

    // Add bug details
    const details: string[] = [];

    if (report.errorMessage) {
        details.push(`**Error:** ${report.errorMessage}`);
    }

    if (report.route) {
        details.push(`**Route:** ${report.route}`);
    }

    if (report.category) {
        const categoryEmoji = report.category === 'performance' ? '⚡' : '🐛';
        details.push(`**Category:** ${categoryEmoji} ${report.category}`);
    }

    if (report.networkStatus) {
        details.push(`**Network:** ${report.networkStatus}`);
    }

    if (report.browserInfo) {
        details.push(`**Browser:** ${report.browserInfo.userAgent}`);
        details.push(`**Viewport:** ${report.browserInfo.viewport.width}x${report.browserInfo.viewport.height}`);
    }

    if (details.length > 0) {
        sections.push(`## Bug Details\n\n${details.join('\n')}`);
    }

    // Add stack trace if available (truncated)
    if (report.stackTrace) {
        const truncatedTrace = report.stackTrace.length > 500
            ? `${report.stackTrace.slice(0, 500)}...`
            : report.stackTrace;
        sections.push(`## Stack Trace\n\n\`\`\`\n${truncatedTrace}\n\`\`\``);
    }

    // NOTE: Session logs are NOT included in the GitHub issue body
    // They will be added to agent prompts only

    sections.push(`---\n\n_Synced from bug report \`${report._id}\`_`);

    return sections.join('\n\n');
}

function getBugLabels(report: ReportDocument): string[] {
    const labels: string[] = ['bug'];
    if (report.category) {
        labels.push(`category:${report.category}`);
    }
    return labels;
}

// ============================================================
// PUBLIC API
// ============================================================

export interface SyncToGitHubResult {
    success: boolean;
    issueNumber?: number;
    issueUrl?: string;
    projectItemId?: string;
    error?: string;
}

/**
 * Sync a feature request to GitHub
 * Creates an issue and adds it to the project with Backlog status
 */
export async function syncFeatureRequestToGitHub(
    requestId: string
): Promise<SyncToGitHubResult> {
    try {
        // Get the feature request
        const request = await featureRequests.findFeatureRequestById(requestId);
        if (!request) {
            return { success: false, error: 'Feature request not found' };
        }

        // Check if already synced
        if (request.githubIssueUrl) {
            return {
                success: true,
                issueNumber: request.githubIssueNumber,
                issueUrl: request.githubIssueUrl,
                projectItemId: request.githubProjectItemId,
            };
        }

        // Initialize project management adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Create the issue
        const issueBody = buildIssueBody(request);
        const labels = getLabels(request);

        const issueResult = await adapter.createIssue(request.title, issueBody, labels);
        const { number: issueNumber, url: issueUrl, nodeId: issueNodeId } = issueResult;

        // Add issue to project
        const projectItemId = await adapter.addIssueToProject(issueNodeId);

        // Set status to Backlog
        await adapter.updateItemStatus(projectItemId, STATUSES.backlog);

        // Create empty artifact comment (design docs and implementation PRs will be tracked here)
        await ensureArtifactComment(adapter, issueNumber);

        // Update MongoDB with GitHub fields
        await featureRequests.updateGitHubFields(requestId, {
            githubIssueUrl: issueUrl,
            githubIssueNumber: issueNumber,
            githubProjectItemId: projectItemId,
        });

        // Send routing notification
        try {
            await sendFeatureRoutingNotification(request, { number: issueNumber, url: issueUrl });
        } catch (error) {
            // Don't fail if notification fails
            console.warn('Failed to send routing notification:', error);
        }

        return {
            success: true,
            issueNumber,
            issueUrl,
            projectItemId,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('GitHub sync error:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Approve a feature request and sync to GitHub
 * Updates MongoDB status to 'in_progress' and creates GitHub issue
 */
export async function approveFeatureRequest(
    requestId: string
): Promise<{
    success: boolean;
    featureRequest?: FeatureRequestDocument;
    githubResult?: SyncToGitHubResult;
    error?: string;
}> {
    try {
        // First update the MongoDB status to in_progress
        const updated = await featureRequests.updateFeatureRequestStatus(
            requestId,
            'in_progress'
        );

        if (!updated) {
            return { success: false, error: 'Feature request not found' };
        }

        // Then sync to GitHub (creates issue with Backlog status)
        const githubResult = await syncFeatureRequestToGitHub(requestId);

        if (!githubResult.success) {
            // Revert status if GitHub sync failed
            await featureRequests.updateFeatureRequestStatus(requestId, 'new');
            return {
                success: false,
                error: `GitHub sync failed: ${githubResult.error}`,
            };
        }

        // NOTE: Status stays in Backlog after approval
        // Admin will route to appropriate phase via Telegram routing buttons
        // This allows admin to choose: Product Design, Tech Design, Implementation, or keep in Backlog

        // Fetch the updated request with GitHub fields
        const finalRequest = await featureRequests.findFeatureRequestById(requestId);

        return {
            success: true,
            featureRequest: finalRequest || undefined,
            githubResult,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Approve feature request error:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Sync a bug report to GitHub
 * Creates an issue and adds it to the project with Backlog status
 */
export async function syncBugReportToGitHub(
    reportId: string
): Promise<SyncToGitHubResult> {
    try {
        // Get the bug report
        const report = await reports.findReportById(reportId);
        if (!report) {
            return { success: false, error: 'Bug report not found' };
        }

        // Check if already synced
        if (report.githubIssueUrl) {
            return {
                success: true,
                issueNumber: report.githubIssueNumber,
                issueUrl: report.githubIssueUrl,
                projectItemId: report.githubProjectItemId,
            };
        }

        // Initialize project management adapter
        const adapter = getProjectManagementAdapter();
        await adapter.init();

        // Create the issue
        const issueBody = buildBugIssueBody(report);
        const labels = getBugLabels(report);
        const title = report.description?.slice(0, 100) || 'Bug Report';

        const issueResult = await adapter.createIssue(title, issueBody, labels);
        const { number: issueNumber, url: issueUrl, nodeId: issueNodeId } = issueResult;

        // Add issue to project
        const projectItemId = await adapter.addIssueToProject(issueNodeId);

        // Set status to Backlog
        await adapter.updateItemStatus(projectItemId, STATUSES.backlog);

        // Create empty artifact comment (implementation PRs will be tracked here)
        await ensureArtifactComment(adapter, issueNumber);

        // Update MongoDB with GitHub fields
        await reports.updateReport(reportId, {
            githubIssueUrl: issueUrl,
            githubIssueNumber: issueNumber,
            githubProjectItemId: projectItemId,
        });

        // Send routing notification
        try {
            await sendBugRoutingNotification(report, { number: issueNumber, url: issueUrl });
        } catch (error) {
            // Don't fail if notification fails
            console.warn('Failed to send routing notification:', error);
        }

        return {
            success: true,
            issueNumber,
            issueUrl,
            projectItemId,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('GitHub sync error:', errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * Approve a bug report and sync to GitHub
 * Updates MongoDB status to 'investigating' and creates GitHub issue
 */
export async function approveBugReport(
    reportId: string
): Promise<{
    success: boolean;
    bugReport?: ReportDocument;
    githubResult?: SyncToGitHubResult;
    error?: string;
}> {
    try {
        // First update the MongoDB status to investigating
        const updated = await reports.updateReport(reportId, {
            status: 'investigating',
        });

        if (!updated) {
            return { success: false, error: 'Bug report not found' };
        }

        // Then sync to GitHub (creates issue with Backlog status)
        const githubResult = await syncBugReportToGitHub(reportId);

        if (!githubResult.success) {
            // Revert status if GitHub sync failed
            await reports.updateReport(reportId, { status: 'new' });
            return {
                success: false,
                error: `GitHub sync failed: ${githubResult.error}`,
            };
        }

        // Fetch the updated report with GitHub fields
        const finalReport = await reports.findReportById(reportId);

        return {
            success: true,
            bugReport: finalReport || undefined,
            githubResult,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Approve bug report error:', errorMsg);
        return { success: false, error: errorMsg };
    }
}
