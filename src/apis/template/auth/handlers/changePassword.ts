import bcrypt from 'bcryptjs';
import { changePassword } from '../index';
import {
    ApiHandlerContext,
    ChangePasswordRequest,
    ChangePasswordResponse,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';
import { SALT_ROUNDS } from '../shared';
import { sendTelegramNotificationToUser } from '@/server/template/telegram';

const MIN_PASSWORD_LENGTH = 8;
const GENERIC_AUTH_ERROR = 'Current password is incorrect';

export const changeUserPassword = async (
    request: ChangePasswordRequest,
    context: ApiHandlerContext
): Promise<ChangePasswordResponse> => {
    try {
        if (!context.userId) {
            return { success: false, error: 'Not authenticated' };
        }

        const currentPassword = request.currentPassword ?? '';
        const newPassword = request.newPassword ?? '';

        if (!currentPassword || !newPassword) {
            return { success: false, error: 'Current and new password are required' };
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            return {
                success: false,
                error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
            };
        }

        if (currentPassword === newPassword) {
            return { success: false, error: 'New password must be different from current password' };
        }

        const user = await users.findUserById(context.userId);
        if (!user) {
            return { success: false, error: 'User not found' };
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isPasswordValid) {
            return { success: false, error: GENERIC_AUTH_ERROR };
        }

        const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        const updated = await users.updateUser(context.userId, {
            password_hash: newHash,
            updatedAt: new Date(),
        });
        if (!updated) {
            return { success: false, error: 'User not found' };
        }

        // Fire-and-forget: notify the user out-of-band so a hijacked session
        // can't silently change the password without the real owner finding out.
        // Skips silently if the user has no Telegram chat ID configured.
        void sendTelegramNotificationToUser(
            context.userId,
            `🔐 Your password was just changed.\n\nIf this wasn't you, contact the administrator immediately.`
        ).catch((error) => {
            console.error('Failed to send password-change notification:', error);
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('Change password error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to change password',
        };
    }
};

export { changePassword };
