/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for feature and bug routing
 */

import { getProjectManagementAdapter } from '@/server/project-management';
import { featureRequests, reports } from '@/server/database';
import {
    logWebhookAction,
    logWebhookPhaseStart,
    logWebhookPhaseEnd,
    logExists,
} from '@/agents/lib/logging';
import { answerCallbackQuery, editMessageWithRouting } from '../telegram-api';
import {
    FEATURE_ROUTING_STATUS_MAP,
    BUG_ROUTING_STATUS_MAP,
    ROUTING_DESTINATION_LABELS,
} from '../constants';
import type { TelegramCallbackQuery, HandlerResult } from '../types';

/**
 * Handle feature routing
 * Callback format: "route_feature:requestId:destination"
 */
export async function handleFeatureRouting(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    requestId: string,
    destination: string
): Promise<HandlerResult> {
    // Get feature request from MongoDB
    const request = await featureRequests.findFeatureRequestById(requestId);
    if (!request || !request.githubProjectItemId) {
        console.warn(`[LOG:ROUTING] Feature request not found or not synced: ${requestId}`);
        return { success: false, error: 'Feature request not found or not synced' };
    }

    const targetStatus = FEATURE_ROUTING_STATUS_MAP[destination];
    if (!targetStatus) {
        console.warn(`[LOG:ROUTING] Invalid routing destination: ${destination} for request ${requestId}`);
        return { success: false, error: 'Invalid destination' };
    }

    // Update GitHub Project status
    const adapter = getProjectManagementAdapter();
    await adapter.init();
    await adapter.updateItemStatus(request.githubProjectItemId, targetStatus);

    // Clear review status if moving to a phase that agents process
    if (destination !== 'backlog' && adapter.hasReviewStatusField()) {
        await adapter.clearItemReviewStatus(request.githubProjectItemId);
    }

    // Log to agent log file
    const issueNumber = request.githubIssueNumber;
    if (issueNumber && logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Admin Routing', 'telegram');
        logWebhookAction(issueNumber, 'routed', `Routed to ${ROUTING_DESTINATION_LABELS[destination]}`, {
            requestId,
            destination,
            targetStatus,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Routing', 'success', 'telegram');
    }

    await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `✅ Moved to ${ROUTING_DESTINATION_LABELS[destination]}`
    );

    // Edit message to show action taken
    if (callbackQuery.message) {
        await editMessageWithRouting(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            ROUTING_DESTINATION_LABELS[destination]
        );
    }

    console.log(`Telegram webhook: routed feature ${requestId} to ${destination}`);
    return { success: true };
}

/**
 * Handle bug routing
 * Callback format: "route_bug:reportId:destination"
 */
export async function handleBugRouting(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    reportId: string,
    destination: string
): Promise<HandlerResult> {
    // Get bug report from MongoDB
    const report = await reports.findReportById(reportId);
    if (!report || !report.githubProjectItemId) {
        console.warn(`[LOG:ROUTING] Bug report not found or not synced: ${reportId}`);
        return { success: false, error: 'Bug report not found or not synced' };
    }

    const targetStatus = BUG_ROUTING_STATUS_MAP[destination];
    if (!targetStatus) {
        console.warn(`[LOG:ROUTING] Invalid routing destination: ${destination} for report ${reportId}`);
        return { success: false, error: 'Invalid destination' };
    }

    // Update GitHub Project status
    const adapter = getProjectManagementAdapter();
    await adapter.init();
    await adapter.updateItemStatus(report.githubProjectItemId, targetStatus);

    // Clear review status if moving to a phase that agents process
    if (destination !== 'backlog' && adapter.hasReviewStatusField()) {
        await adapter.clearItemReviewStatus(report.githubProjectItemId);
    }

    // Log to agent log file
    const issueNumber = report.githubIssueNumber;
    if (issueNumber && logExists(issueNumber)) {
        logWebhookPhaseStart(issueNumber, 'Admin Routing', 'telegram');
        logWebhookAction(issueNumber, 'routed', `Routed to ${ROUTING_DESTINATION_LABELS[destination]}`, {
            reportId,
            destination,
            targetStatus,
        });
        logWebhookPhaseEnd(issueNumber, 'Admin Routing', 'success', 'telegram');
    }

    await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `✅ Moved to ${ROUTING_DESTINATION_LABELS[destination]}`
    );

    // Edit message to show action taken
    if (callbackQuery.message) {
        await editMessageWithRouting(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            ROUTING_DESTINATION_LABELS[destination]
        );
    }

    console.log(`Telegram webhook: routed bug ${reportId} to ${destination}`);
    return { success: true };
}
