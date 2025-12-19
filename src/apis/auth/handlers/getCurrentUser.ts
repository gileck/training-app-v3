import { me } from '../index';
import {
    ApiHandlerContext,
    CurrentUserResponse,
} from '../types';
import * as users from '@/server/database/collections/users/users';
import { sanitizeUser } from '../shared';

// Get current user endpoint
export const getCurrentUser = async (
    _: unknown,
    context: ApiHandlerContext
): Promise<CurrentUserResponse> => {
    try {
        if (!context.userId) {
            return { error: "Not authenticated" };
        }

        const user = await users.findUserById(context.userId);
        if (!user) {
            return { error: "User not found" };
        }

        return { user: { ...sanitizeUser(user), isAdmin: context.isAdmin } };
    } catch (error: unknown) {
        console.error("Get current user error:", error);
        return { error: error instanceof Error ? error.message : "Failed to get current user" };
    }
};

// Export API endpoint name
export { me }; 