/**
 * GitHub Sync Service
 *
 * Server-side service for syncing feature requests and bug reports to GitHub.
 * Used by both the API (approve action) and CLI (batch sync).
 *
 * Architecture:
 * - index.ts: Public API (this file) - type-specific wrappers
 * - sync-core.ts: Shared sync logic
 * - types.ts: Shared types
 */

import { featureRequests, reports } from '@/server/database';
import type { FeatureRequestDocument } from '@/server/database/collections/template/feature-requests/types';
import type { ReportDocument } from '@/server/database/collections/template/reports/types';
import {
    sendFeatureRoutingNotification,
    sendBugRoutingNotification,
} from '@/server/telegram';
import { STATUSES } from '@/server/project-management/config';
import { syncItemToGitHub, approveItem } from './sync-core';
import type { SyncToGitHubResult, SyncOptions, SyncItemConfig, ApproveItemConfig } from './types';

// Re-export types for consumers
export type { SyncToGitHubResult, SyncOptions } from './types';

// ============================================================
// FEATURE REQUEST CONFIG
// ============================================================

function buildFeatureIssueBody(request: FeatureRequestDocument): string {
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

function getFeatureLabels(request: FeatureRequestDocument): string[] {
    const labels: string[] = ['feature-request'];
    if (request.priority) {
        labels.push(`priority:${request.priority}`);
    }
    return labels;
}

const featureRequestSyncConfig: SyncItemConfig<FeatureRequestDocument> = {
    getFromDB: (id) => featureRequests.findFeatureRequestById(id),

    isAlreadySynced: (item) => !!item.githubIssueUrl,

    getExistingSyncResult: (item) => ({
        success: true,
        issueNumber: item.githubIssueNumber,
        issueUrl: item.githubIssueUrl,
        projectItemId: item.githubProjectItemId,
    }),

    getTitle: (item) => item.title,

    buildBody: buildFeatureIssueBody,

    getLabels: getFeatureLabels,

    updateDBWithGitHubFields: (id, fields) =>
        featureRequests.updateGitHubFields(id, fields).then(() => {}),

    sendRoutingNotification: (item, issueResult) =>
        sendFeatureRoutingNotification(item, issueResult).then(() => {}),
};

// ============================================================
// BUG REPORT CONFIG
// ============================================================

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

const bugReportSyncConfig: SyncItemConfig<ReportDocument> = {
    getFromDB: (id) => reports.findReportById(id),

    isAlreadySynced: (item) => !!item.githubIssueUrl,

    getExistingSyncResult: (item) => ({
        success: true,
        issueNumber: item.githubIssueNumber,
        issueUrl: item.githubIssueUrl,
        projectItemId: item.githubProjectItemId,
    }),

    getTitle: (item) => item.description?.slice(0, 100) || 'Bug Report',

    buildBody: buildBugIssueBody,

    getLabels: getBugLabels,

    updateDBWithGitHubFields: (id, fields) =>
        reports.updateReport(id, fields).then(() => {}),

    sendRoutingNotification: (item, issueResult) =>
        sendBugRoutingNotification(item, issueResult).then(() => {}),

    initialStatus: STATUSES.bugInvestigation,
};

// ============================================================
// PUBLIC API - Feature Requests
// ============================================================

/**
 * Sync a feature request to GitHub
 * Creates an issue and adds it to the project with Backlog status
 */
export async function syncFeatureRequestToGitHub(
    requestId: string,
    options?: SyncOptions
): Promise<SyncToGitHubResult> {
    return syncItemToGitHub(requestId, featureRequestSyncConfig, options);
}

/**
 * Approve a feature request and sync to GitHub
 * Updates MongoDB status to 'in_progress' and creates GitHub issue
 */
export async function approveFeatureRequest(
    requestId: string,
    syncOptions?: SyncOptions
): Promise<{
    success: boolean;
    featureRequest?: FeatureRequestDocument;
    githubResult?: SyncToGitHubResult;
    error?: string;
}> {
    const approveConfig: ApproveItemConfig<FeatureRequestDocument> = {
        getFromDB: (id) => featureRequests.findFeatureRequestById(id),
        setInProgressStatus: (id) => featureRequests.updateFeatureRequestStatus(id, 'in_progress'),
        revertToNewStatus: (id) => featureRequests.updateFeatureRequestStatus(id, 'new').then(() => {}),
        syncToGitHub: (id, options) => syncFeatureRequestToGitHub(id, options),
    };

    const result = await approveItem(requestId, approveConfig, syncOptions);

    return {
        success: result.success,
        featureRequest: result.item,
        githubResult: result.githubResult,
        error: result.error,
    };
}

// ============================================================
// PUBLIC API - Bug Reports
// ============================================================

/**
 * Sync a bug report to GitHub
 * Creates an issue and adds it to the project with Backlog status
 */
export async function syncBugReportToGitHub(
    reportId: string,
    options?: SyncOptions
): Promise<SyncToGitHubResult> {
    return syncItemToGitHub(reportId, bugReportSyncConfig, options);
}

/**
 * Approve a bug report and sync to GitHub
 * Updates MongoDB status to 'investigating' and creates GitHub issue
 */
export async function approveBugReport(
    reportId: string,
    syncOptions?: SyncOptions
): Promise<{
    success: boolean;
    bugReport?: ReportDocument;
    githubResult?: SyncToGitHubResult;
    error?: string;
}> {
    const approveConfig: ApproveItemConfig<ReportDocument> = {
        getFromDB: (id) => reports.findReportById(id),
        setInProgressStatus: async (id) => {
            const updated = await reports.updateReport(id, { status: 'investigating' });
            return updated ? await reports.findReportById(id) : null;
        },
        revertToNewStatus: (id) => reports.updateReport(id, { status: 'new' }).then(() => {}),
        syncToGitHub: (id, options) => syncBugReportToGitHub(id, options),
    };

    const result = await approveItem(reportId, approveConfig, syncOptions);

    return {
        success: result.success,
        bugReport: result.item,
        githubResult: result.githubResult,
        error: result.error,
    };
}
