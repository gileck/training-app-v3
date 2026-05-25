import { requestPasswordReset } from '../index';
import {
    ApiHandlerContext,
    RequestPasswordResetRequest,
    RequestPasswordResetResponse,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';
import { createPasswordResetToken } from '@/server/database/collections/template/password-reset-tokens';
import { getBaseUrl, sendTelegramNotificationToUser } from '@/server/template/telegram';
import { toStringId } from '@/server/template/utils';

/**
 * Always returns `{ success: true }` to prevent enumeration of usernames or
 * which users have Telegram configured. All "failure" branches (no such user,
 * no chat ID, Telegram outage) are silently swallowed and logged server-side.
 */
export const requestUserPasswordReset = async (
    request: RequestPasswordResetRequest,
    _context: ApiHandlerContext
): Promise<RequestPasswordResetResponse> => {
    const username = (request.username ?? '').trim();
    if (!username) {
        // Even input validation errors return success — don't help attackers
        // distinguish "missing field" from "no such user".
        return { success: true };
    }

    try {
        const user = await users.findUserByUsername(username);
        if (!user) {
            console.info('[password-reset] No user for username:', username);
            return { success: true };
        }

        if (!user.telegramChatId) {
            console.info('[password-reset] User has no Telegram chat ID:', username);
            return { success: true };
        }

        const userId = toStringId(user._id);

        // Mirror the gate in loginUser.ts: pending or rejected users cannot
        // sign in, so they must not be able to rotate their password either.
        // Admin (ADMIN_USER_ID) bypasses the gate just like at login.
        // Missing approvalStatus is treated as 'approved' for legacy users.
        const isAdmin = !!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;
        const status = user.approvalStatus ?? 'approved';
        if (!isAdmin && status !== 'approved') {
            console.info('[password-reset] User not approved:', username, status);
            return { success: true };
        }
        const { rawToken } = await createPasswordResetToken(userId);
        const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

        // Fire-and-forget so response time doesn't leak whether Telegram was
        // actually called (timing-side-channel for enumeration).
        void sendTelegramNotificationToUser(
            userId,
            `🔐 Password reset requested for your account.\n\nClick this link to set a new password (valid for 30 minutes):\n${resetUrl}\n\nIf you didn't request this, you can ignore this message.`
        ).catch((error) => {
            console.error('[password-reset] Failed to send Telegram message:', error);
        });
    } catch (error) {
        // Never surface internal errors — they could leak info.
        console.error('[password-reset] Unexpected error:', error);
    }

    return { success: true };
};

export { requestPasswordReset };
