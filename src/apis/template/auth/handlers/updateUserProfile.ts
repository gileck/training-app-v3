import { updateProfile } from '../index';
import {
    ApiHandlerContext,
    UpdateProfileRequest,
    UpdateProfileResponse,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';
import { sanitizeUser } from '../shared';
import type { TwoFactorMethod } from '../types';

// Update profile endpoint
export const updateUserProfile = async (
    request: UpdateProfileRequest,
    context: ApiHandlerContext
): Promise<UpdateProfileResponse> => {
    try {
        if (!context.userId) {
            return { success: false, error: "Not authenticated" };
        }

        // Validate update data
        if (!request.username && !request.email && !request.profilePicture && request.notificationsEnabled === undefined && request.telegramChatId === undefined && request.twoFactorEnabled === undefined && request.twoFactorMethod === undefined) {
            return { success: false, error: "No update data provided" };
        }

        const existingUser = await users.findUserById(context.userId);
        if (!existingUser) {
            return { success: false, error: "User not found" };
        }

        // Prepare update object
        const updateData: {
            updatedAt: Date;
            username?: string;
            email?: string;
            profilePicture?: string;
            notificationsEnabled?: boolean;
            telegramChatId?: string;
            twoFactorEnabled?: boolean;
            twoFactorMethod?: TwoFactorMethod;
        } = {
            updatedAt: new Date()
        };

        if (request.username) {
            updateData.username = request.username;
        }

        if (request.email !== undefined) {
            updateData.email = request.email;
        }

        if (request.profilePicture) {
            updateData.profilePicture = request.profilePicture;
        }

        if (request.notificationsEnabled !== undefined) {
            updateData.notificationsEnabled = request.notificationsEnabled;
        }

        if (request.telegramChatId !== undefined) {
            updateData.telegramChatId = request.telegramChatId;
        }

        const effectiveEmail = request.email !== undefined
            ? request.email.trim()
            : existingUser.email?.trim();
        const effectiveTelegramChatId = request.telegramChatId !== undefined
            ? request.telegramChatId.trim()
            : existingUser.telegramChatId?.trim();
        const effectiveTwoFactorEnabled = request.twoFactorEnabled
            ?? existingUser.twoFactorEnabled
            ?? existingUser.telegramTwoFactorEnabled
            ?? false;
        const effectiveTwoFactorMethod = request.twoFactorMethod
            ?? existingUser.twoFactorMethod
            ?? (existingUser.telegramTwoFactorEnabled ? 'telegram' : undefined)
            ?? (effectiveEmail ? 'email' : effectiveTelegramChatId ? 'telegram' : undefined);

        if (effectiveTwoFactorEnabled) {
            if (!effectiveEmail && !effectiveTelegramChatId) {
                return { success: false, error: "Add an email address or Telegram chat ID before enabling 2-factor authentication" };
            }

            if (effectiveTwoFactorMethod === 'email' && !effectiveEmail) {
                return { success: false, error: "Add an email address before enabling email 2-factor authentication" };
            }

            if (effectiveTwoFactorMethod === 'telegram' && !effectiveTelegramChatId) {
                return { success: false, error: "Add your Telegram chat ID before enabling Telegram 2-factor authentication" };
            }
        }

        if (request.twoFactorEnabled !== undefined) {
            updateData.twoFactorEnabled = request.twoFactorEnabled;
        }

        if (request.twoFactorMethod !== undefined || request.twoFactorEnabled !== undefined) {
            updateData.twoFactorMethod = effectiveTwoFactorMethod;
        }

        // Update user in database
        const updatedUser = await users.updateUser(context.userId, updateData);
        if (!updatedUser) {
            return { success: false, error: "User not found" };
        }

        return {
            success: true,
            user: { ...sanitizeUser(updatedUser), isAdmin: context.isAdmin }
        };
    } catch (error: unknown) {
        console.error("Update profile error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update profile"
        };
    }
};

// Export API endpoint name
export { updateProfile }; 
