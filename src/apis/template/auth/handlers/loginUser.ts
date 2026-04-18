import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { login } from '../index';
import {
    ApiHandlerContext,
    LoginRequest,
    LoginResponse,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';
import {
    COOKIE_NAME,
    COOKIE_OPTIONS,
    JWT_EXPIRES_IN,
    getJwtSecret,
    sanitizeUser,
} from "../shared";
import { toStringId } from '@/server/template/utils';
import { authOverrides } from '@/apis/auth-overrides';

// Login endpoint
export const loginUser = async (
    request: LoginRequest,
    context: ApiHandlerContext
): Promise<LoginResponse> => {
    try {
        // Validate input
        if (!request.username || !request.password) {
            return { error: "Username and password are required" };
        }

        // Find user by username
        const user = await users.findUserByUsername(request.username);
        if (!user) {
            return { error: "Invalid username or password" };
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(request.password, user.password_hash);
        if (!isPasswordValid) {
            return { error: "Invalid username or password" };
        }

        const userId = toStringId(user._id);
        const isAdmin = !!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;

        // Admin-approved signups gate: block login for any user whose
        // approval is still pending or was rejected. The admin user
        // (ADMIN_USER_ID) always bypasses this gate so they can log in
        // to the approvals page.
        //
        // Missing approvalStatus is treated as 'approved' for backward
        // compatibility with users created before this feature existed.
        if (authOverrides.requireAdminApproval === true && !isAdmin) {
            const status = user.approvalStatus ?? 'approved';
            if (status === 'pending') {
                return { error: 'Your account is pending admin approval. You will be notified once approved.' };
            }
            if (status === 'rejected') {
                return { error: 'Your account has been rejected. Please contact the administrator.' };
            }
        }

        // Run project-specific login validation
        if (authOverrides.validateLogin) {
            const overrideError = await authOverrides.validateLogin({ user, request, context });
            if (overrideError) {
                return { error: overrideError };
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId },
            getJwtSecret(),
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set auth cookie
        context.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        return { user: { ...sanitizeUser(user), isAdmin } };
    } catch (error: unknown) {
        console.error("Login error:", error);
        return { error: error instanceof Error ? error.message : "Login failed" };
    }
};

// Export API endpoint name
export { login }; 