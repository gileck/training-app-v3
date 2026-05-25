import bcrypt from 'bcryptjs';
import { resetPassword } from '../index';
import {
    ApiHandlerContext,
    ResetPasswordRequest,
    ResetPasswordResponse,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';
import {
    consumePasswordResetToken,
    findValidPasswordResetToken,
    invalidateAllPasswordResetTokensForUser,
} from '@/server/database/collections/template/password-reset-tokens';
import { sendTelegramNotificationToUser } from '@/server/template/telegram';
import { SALT_ROUNDS } from '../shared';
import { toStringId } from '@/server/template/utils';

const MIN_PASSWORD_LENGTH = 8;
const GENERIC_TOKEN_ERROR = 'This reset link is invalid or has expired. Please request a new one.';

export const resetUserPassword = async (
    request: ResetPasswordRequest,
    _context: ApiHandlerContext
): Promise<ResetPasswordResponse> => {
    try {
        const token = request.token ?? '';
        const newPassword = request.newPassword ?? '';

        if (!token || !newPassword) {
            return { success: false, error: 'Missing token or new password' };
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            return {
                success: false,
                error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
            };
        }

        const tokenDoc = await findValidPasswordResetToken(token);
        if (!tokenDoc) {
            return { success: false, error: GENERIC_TOKEN_ERROR };
        }

        // Atomically consume the token before doing anything else.
        // If two requests race, only one will get the consumed doc back.
        const consumed = await consumePasswordResetToken(tokenDoc._id);
        if (!consumed) {
            return { success: false, error: GENERIC_TOKEN_ERROR };
        }

        const userId = toStringId(consumed.userId);
        const user = await users.findUserById(userId);
        if (!user) {
            return { success: false, error: GENERIC_TOKEN_ERROR };
        }

        const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        const updated = await users.updateUser(userId, {
            password_hash: newHash,
            updatedAt: new Date(),
        });
        if (!updated) {
            return { success: false, error: GENERIC_TOKEN_ERROR };
        }

        // Invalidate any other outstanding tokens for this user.
        await invalidateAllPasswordResetTokensForUser(userId);

        // Fire-and-forget confirmation so the real owner sees the change.
        void sendTelegramNotificationToUser(
            userId,
            `🔐 Your password was just reset via the forgot-password flow.\n\nIf this wasn't you, contact the administrator immediately.`
        ).catch((error) => {
            console.error('[password-reset] Failed to send confirmation Telegram message:', error);
        });

        return { success: true };
    } catch (error) {
        console.error('[password-reset] Reset failed:', error);
        return { success: false, error: 'Failed to reset password' };
    }
};

export { resetPassword };
