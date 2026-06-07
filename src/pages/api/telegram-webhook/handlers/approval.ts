/* eslint-disable restrict-api-routes/no-direct-api-routes */
/**
 * Handler for Telegram login approval (admin-approved sign-in).
 */

import { loginApprovals } from '@/server/database';
import { editMessageText } from '../telegram-api';
import { escapeHtml } from '../utils';
import type { TelegramCallbackQuery, HandlerResult } from '../types';

/**
 * Handle Telegram login approval
 * Callback format: "approve_login:approvalId"
 */
export async function handleLoginApproval(
    botToken: string,
    callbackQuery: TelegramCallbackQuery,
    approvalId: string
): Promise<HandlerResult> {
    const approval = await loginApprovals.approveLoginApproval(
        approvalId,
        'telegram',
        String(callbackQuery.from.id)
    );

    if (!approval) {
        const existingApproval = await loginApprovals.findLoginApprovalById(approvalId);

        if (!existingApproval) {
            return { success: false, error: 'Invalid approval request' };
        }

        if (existingApproval.expiresAt.getTime() <= Date.now()) {
            if (callbackQuery.message) {
                await editMessageText(
                    botToken,
                    callbackQuery.message.chat.id,
                    callbackQuery.message.message_id,
                    `${escapeHtml(callbackQuery.message.text || '')}\n\n⏰ <b>Login request expired</b>\nStart the login again in the app.`,
                    'HTML'
                );
            }
            return { success: false, error: 'Login request expired' };
        }

        if (existingApproval.status === 'approved') {
            if (callbackQuery.message) {
                await editMessageText(
                    botToken,
                    callbackQuery.message.chat.id,
                    callbackQuery.message.message_id,
                    `${escapeHtml(callbackQuery.message.text || '')}\n\n✅ <b>Login already approved</b>\nThe app should continue automatically.`,
                    'HTML'
                );
            }
            return { success: true };
        }

        return { success: false, error: 'Unable to approve login' };
    }

    if (callbackQuery.message) {
        await editMessageText(
            botToken,
            callbackQuery.message.chat.id,
            callbackQuery.message.message_id,
            `${escapeHtml(callbackQuery.message.text || '')}\n\n✅ <b>Login approved</b>\n${escapeHtml(approval.username)} can return to the app now.`,
            'HTML'
        );
    }

    return { success: true };
}
