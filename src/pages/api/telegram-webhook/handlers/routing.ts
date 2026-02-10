/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handlers for feature and bug routing
 *
 * Thin transport layer: call service + edit message.
 * All business logic (adapter, review status, logging) lives in workflow-service.
 */

import { routeWorkflowItem } from '@/server/workflow-service';
import type { RoutingDestination } from '@/server/workflow-service';
import { editMessageWithRouting } from '../telegram-api';
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
    const result = await routeWorkflowItem(
        { id: requestId, type: 'feature' },
        destination as RoutingDestination
    );

    if (!result.success) {
        console.warn(`[LOG:ROUTING] Feature routing failed for ${requestId}: ${result.error}`);
        return { success: false, error: result.error || 'Routing failed' };
    }

    if (callbackQuery.message) {
        await editMessageWithRouting(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            result.targetLabel || destination
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
    const result = await routeWorkflowItem(
        { id: reportId, type: 'bug' },
        destination as RoutingDestination
    );

    if (!result.success) {
        console.warn(`[LOG:ROUTING] Bug routing failed for ${reportId}: ${result.error}`);
        return { success: false, error: result.error || 'Routing failed' };
    }

    if (callbackQuery.message) {
        await editMessageWithRouting(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            callbackQuery.message.text || '',
            result.targetLabel || destination
        );
    }

    console.log(`Telegram webhook: routed bug ${reportId} to ${destination}`);
    return { success: true };
}
