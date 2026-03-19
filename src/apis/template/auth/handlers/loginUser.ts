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

        // Generate JWT token
        const userId = toStringId(user._id);
        const token = jwt.sign(
            { userId },
            getJwtSecret(),
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set auth cookie
        context.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        const isAdmin = !!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;
        return { user: { ...sanitizeUser(user), isAdmin } };
    } catch (error: unknown) {
        console.error("Login error:", error);
        return { error: error instanceof Error ? error.message : "Login failed" };
    }
};

// Export API endpoint name
export { login }; 