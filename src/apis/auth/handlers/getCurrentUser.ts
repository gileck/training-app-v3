import { me } from '../index';
import {
    ApiHandlerContext,
    CurrentUserResponse,
} from '../types';
import * as users from '@/server/database/collections/users/users';
import { sanitizeUser } from '../shared';

// Get current user endpoint
// NOTE: Returns { user: null } for unauthenticated users - this is NOT an error,
// it's the expected response for new users or users without a session.
export const getCurrentUser = async (
    _: unknown,
    context: ApiHandlerContext
): Promise<CurrentUserResponse> => {
    try {
        // No session - return null user with debug info
        if (!context.userId) {
            return {
                user: null,
                authDebug: context.authDebug,
            };
        }

        const user = await users.findUserById(context.userId);
        if (!user) {
            // User ID in token but not in DB - this is an actual error
            return {
                error: "User not found",
                authDebug: context.authDebug,
            };
        }

        return {
            user: { ...sanitizeUser(user), isAdmin: context.isAdmin },
            authDebug: context.authDebug,
        };
    } catch (error: unknown) {
        console.error("Get current user error:", error);
        return {
            error: error instanceof Error ? error.message : "Failed to get current user",
            authDebug: context.authDebug,
        };
    }
};

// Export API endpoint name
export { me }; 