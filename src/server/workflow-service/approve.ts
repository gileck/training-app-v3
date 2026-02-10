/**
 * Workflow Service — Approve
 *
 * Unified approval that handles business logic + notifications.
 */

import { featureRequests, reports } from '@/server/database';
import {
    approveFeatureRequest as approveFeatureRequestSync,
    approveBugReport as approveBugReportSync,
} from '@/server/github-sync';
import { STATUSES } from '@/server/project-management/config';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExists,
} from '@/agents/lib/logging';
import { routeWorkflowItem } from './route';
import { notifyApproved } from './notify';
import type { WorkflowItemRef, ApproveOptions, ApproveResult } from './types';

/**
 * Approve a workflow item — creates GitHub issue, logs, and optionally routes.
 *
 * 1. Validates state (prevents double-approval)
 * 2. Calls github-sync to create issue
 * 3. Agent logging
 * 4. Routes if initialRoute provided
 * 5. Sends Telegram notification
 * 6. Returns needsRouting flag
 */
export async function approveWorkflowItem(
    ref: WorkflowItemRef,
    options?: ApproveOptions
): Promise<ApproveResult> {
    // 1. Validate state — check for double-approval
    if (ref.type === 'feature') {
        const existing = await featureRequests.findFeatureRequestById(ref.id);
        if (!existing) {
            return { success: false, error: 'Item not found', needsRouting: false };
        }
        if (existing.githubIssueUrl) {
            return { success: false, error: 'Already approved', needsRouting: false };
        }
    } else {
        const existing = await reports.findReportById(ref.id);
        if (!existing) {
            return { success: false, error: 'Item not found', needsRouting: false };
        }
        if (existing.githubIssueUrl) {
            return { success: false, error: 'Already approved', needsRouting: false };
        }
    }

    // 2. Call github-sync (reuse existing functions)
    // Build sync options: if routing to backlog, override initial status
    const syncOptions = options?.initialRoute === 'backlog' || options?.initialStatusOverride
        ? { initialStatusOverride: options.initialStatusOverride || STATUSES.backlog }
        : undefined;

    let result;
    let title: string | undefined;

    if (ref.type === 'feature') {
        result = await approveFeatureRequestSync(ref.id, syncOptions);
        title = result.featureRequest?.title;
    } else {
        result = await approveBugReportSync(ref.id, syncOptions);
        title = result.bugReport?.description?.slice(0, 100) || 'Bug Report';
    }

    if (!result.success) {
        return {
            success: false,
            error: result.error,
            needsRouting: false,
        };
    }

    const issueNumber = result.githubResult?.issueNumber;
    const issueUrl = result.githubResult?.issueUrl;
    const projectItemId = result.githubResult?.projectItemId;

    // 3. Agent logging
    if (issueNumber && logExists(issueNumber)) {
        const actionType = ref.type === 'feature' ? 'feature_approved' : 'bug_approved';
        const suffix = options?.initialRoute === 'backlog' ? '_backlog' : '';
        logWebhookPhaseStart(issueNumber, 'Admin Approval', 'webhook');
        logWebhookAction(issueNumber, `${actionType}${suffix}`, `${ref.type === 'feature' ? 'Feature' : 'Bug'} "${title}" approved${options?.initialRoute ? ` to ${options.initialRoute}` : ''}`, {
            itemId: ref.id,
            itemType: ref.type,
            issueNumber,
            issueUrl,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Approval', 'success', 'webhook');
    }

    // 4. Route if initialRoute provided (not backlog — backlog is handled via initialStatusOverride)
    if (options?.initialRoute && options.initialRoute !== 'backlog') {
        await routeWorkflowItem(ref, options.initialRoute);
    }

    // 5. Determine needsRouting: features without explicit route need routing, bugs don't (auto-routed)
    const needsRouting = ref.type === 'feature'
        && !options?.initialRoute
        && !options?.initialStatusOverride;

    const approveResult: ApproveResult = {
        success: true,
        issueNumber,
        issueUrl,
        projectItemId,
        needsRouting,
        title,
    };

    // 6. Send Telegram notification (fire-and-forget)
    // Only send if needsRouting (features that need routing get routing buttons)
    // Bugs are auto-routed to Bug Investigation — the routing notification was skipped
    if (needsRouting) {
        notifyApproved(ref, approveResult).catch(() => {});
    }

    return approveResult;
}
