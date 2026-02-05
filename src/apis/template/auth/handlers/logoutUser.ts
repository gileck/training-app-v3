import { logout } from '../index';
import {
    ApiHandlerContext,
    LogoutResponse,
} from '../types';
import { COOKIE_NAME, COOKIE_OPTIONS } from "../shared";

// Logout endpoint
export const logoutUser = async (
    _: unknown,
    context: ApiHandlerContext
): Promise<LogoutResponse> => {
    try {
        context.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
        return { success: true };
    } catch (error: unknown) {
        console.error("Logout error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Logout failed" };
    }
};

// Export API endpoint name
export { logout }; 