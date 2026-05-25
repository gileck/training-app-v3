import { me } from '../index';
import {
    ApiHandlerContext,
    CurrentUserResponse,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';
import { sanitizeUser } from '../shared';
import { recordSession } from '@/server/template/sessions/recordSession';

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

        // Record an auto-login session + bump lastSeenAt. Fire-and-forget.
        recordSession(context.userId, 'auto');

        return {
            user: { ...sanitizeUser(user), isAdmin: context.isAdmin },
            authDebug: context.authDebug,
        };
    } catch (error: unknown) {
        console.error("Get current user error:", error);
        const message = error instanceof Error ? error.message : "Failed to get current user";
        const isConnectionError = error instanceof Error && (
            error.name === 'MongoServerSelectionError' ||
            error.name === 'MongoNetworkError' ||
            error.message.includes('ENOTFOUND') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout') ||
            error.message.includes('connect')
        );
        return {
            error: message,
            connectionError: isConnectionError,
            authDebug: context.authDebug,
        };
    }
};

// Export API endpoint name
export { me }; 