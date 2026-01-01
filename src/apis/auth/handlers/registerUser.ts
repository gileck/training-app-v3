import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { register } from '../index';
import {
    ApiHandlerContext,
    RegisterRequest,
    RegisterResponse,
} from '../types';
import * as users from '@/server/database/collections/users/users';
import { UserCreate } from '@/server/database/collections/users/types';
import {
    COOKIE_NAME,
    COOKIE_OPTIONS,
    JWT_EXPIRES_IN,
    JWT_SECRET,
    SALT_ROUNDS,
    sanitizeUser,
} from "../shared";

// Register endpoint
export const registerUser = async (
    request: RegisterRequest,
    context: ApiHandlerContext
): Promise<RegisterResponse> => {
    try {
        // Validate input
        if (!request.username || !request.password) {
            return { error: "Username and password are required" };
        }

        // Check for existing email if provided
        if (request.email) {
            const existingUser = await users.findUserByEmail(request.email);
            if (existingUser) {
                return { error: "Email already exists" };
            }
        }

        // Hash password and create user
        const passwordHash = await bcrypt.hash(request.password, SALT_ROUNDS);
        const userData: UserCreate = {
            username: request.username,
            password_hash: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...(request.email && { email: request.email })
        };

        const newUser = await users.insertUser(userData);

        // Generate JWT token
        const token = jwt.sign(
            { userId: newUser._id.toHexString() },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set auth cookie
        context.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        const isAdmin = !!process.env.ADMIN_USER_ID && newUser._id.toHexString() === process.env.ADMIN_USER_ID;
        return { user: { ...sanitizeUser(newUser), isAdmin } };
    } catch (error: unknown) {
        console.error("Registration error:", error);
        return { error: error instanceof Error ? error.message : "Registration failed" };
    }
};

// Export API endpoint name
export { register }; 