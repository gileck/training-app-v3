import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { register } from '../index';
import {
    ApiHandlerContext,
    RegisterRequest,
    RegisterResponse,
} from '../types';
import * as users from '@/server/database/collections/template/users/users';
import { UserCreate } from '@/server/database/collections/template/users/types';
import {
    COOKIE_NAME,
    COOKIE_OPTIONS,
    JWT_EXPIRES_IN,
    getJwtSecret,
    SALT_ROUNDS,
    sanitizeUser,
} from "../shared";
import { toStringId } from '@/server/template/utils';
import { authOverrides } from '@/apis/auth-overrides';
import { sendNotificationToOwner } from '@/server/template/telegram';
import { appConfig } from '@/app.config';

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

        // Run project-specific registration validation
        if (authOverrides.validateRegistration) {
            const overrideError = await authOverrides.validateRegistration({ request, context });
            if (overrideError) {
                return { error: overrideError };
            }
        }

        // Check for existing username. If the row belongs to a previously
        // rejected user, surface a clear message rather than the generic
        // "already taken" exception from insertUser. This is the re-apply
        // path for admin-approved signups.
        const existingByUsername = await users.findUserByUsername(request.username);
        if (existingByUsername) {
            if (existingByUsername.approvalStatus === 'rejected') {
                return { error: "This account has been rejected. Please contact the administrator." };
            }
            return { error: "Username already exists" };
        }

        // Check for existing email if provided. Same treatment for rejected
        // users so they are not told "email already taken" which leaks that
        // the address is registered.
        if (request.email) {
            const existingByEmail = await users.findUserByEmail(request.email);
            if (existingByEmail) {
                if (existingByEmail.approvalStatus === 'rejected') {
                    return { error: "This account has been rejected. Please contact the administrator." };
                }
                return { error: "Email already exists" };
            }
        }

        // Admin-approved signups: create the user with 'pending' status,
        // do NOT issue a JWT, and notify the owner via Telegram.
        // Two bypasses:
        //   1. First-user-wins bootstrap: on a fresh deployment with no
        //      users yet, auto-approve the first signup. Assumption: the
        //      first person to reach the signup form on a fresh install
        //      IS the admin. Not transactionally race-proof — two
        //      simultaneous signups on a truly empty collection could
        //      both pass the check and both be auto-approved. The window
        //      is milliseconds on a first deployment and the real admin
        //      can reject the other via /admin/approvals if it happens.
        //   2. Admin bypass: user whose _id matches ADMIN_USER_ID is
        //      always auto-approved on signup (handles the "admin wipes
        //      and re-registers" case when ADMIN_USER_ID is already set).
        const requireApproval = authOverrides.requireAdminApproval === true;
        const isFirstUser = requireApproval && (await users.isUsersCollectionEmpty());

        // Hash password and create user
        const passwordHash = await bcrypt.hash(request.password, SALT_ROUNDS);
        const userData: UserCreate = {
            username: request.username,
            password_hash: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...(request.email && { email: request.email }),
            // Only set 'pending' when approval is required AND this is not
            // the bootstrap first user. First users go straight to the
            // approved branch below.
            ...(requireApproval && !isFirstUser && { approvalStatus: 'pending' }),
        };

        const newUser = await users.insertUser(userData);
        const userId = toStringId(newUser._id);
        const isAdmin = !!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;

        // Pending approval branch: no cookie, no user in response.
        // Skip for: admin (ADMIN_USER_ID bypass) and bootstrap first-user.
        if (requireApproval && !isAdmin && !isFirstUser) {
            // Await the Telegram notification so it actually completes in
            // serverless environments (Vercel can suspend the function as
            // soon as the response is written). Signup is rare, so the
            // extra latency is acceptable; and the internal try/catch in
            // notifyOwnerOfPendingSignup ensures a Telegram outage does not
            // break registration.
            await notifyOwnerOfPendingSignup(newUser.username, request.email);
            return { pendingApproval: true };
        }

        // Admin OR first-user registering under requireApproval: stamp
        // approvalStatus/approvedAt explicitly so the audit trail is
        // consistent with users approved through the normal flow.
        // For isFirstUser we inserted without 'pending', so this
        // promotion just adds the timestamps. For isAdmin we inserted
        // with 'pending' and this flips it to 'approved'.
        const finalUser =
            requireApproval && (isAdmin || isFirstUser)
                ? (await users.setUserApprovalStatus(newUser._id, 'approved')) ?? newUser
                : newUser;

        // First-user bootstrap: log a loud note so the operator knows to
        // grab this _id and set ADMIN_USER_ID on their environment.
        if (isFirstUser) {
            console.log(
                `[registerUser] First-user-wins bootstrap: auto-approved "${newUser.username}" (_id=${userId}). ` +
                `Set ADMIN_USER_ID=${userId} in your environment to grant admin access.`
            );
        }

        // Normal signup: issue JWT and return the user.
        const token = jwt.sign(
            { userId },
            getJwtSecret(),
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set auth cookie
        context.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        return { user: { ...sanitizeUser(finalUser), isAdmin } };
    } catch (error: unknown) {
        console.error("Registration error:", error);
        return { error: error instanceof Error ? error.message : "Registration failed" };
    }
};

/**
 * Send a Telegram notification to the owner about a new pending signup.
 * Renders an inline keyboard button that opens the admin approvals page.
 *
 * Uses the canonical `appConfig.appUrl` so the URL resolution matches
 * the rest of the app's Telegram links (NEXT_PUBLIC_APP_URL override →
 * VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL → production fallback).
 */
async function notifyOwnerOfPendingSignup(
    username: string,
    email: string | undefined
): Promise<void> {
    try {
        const approvalsLink = `${appConfig.appUrl.replace(/\/$/, '')}/admin/approvals`;

        const message = [
            '🆕 New signup pending approval',
            '',
            `Username: ${username}`,
            email ? `Email: ${email}` : 'Email: (not provided)',
        ].join('\n');

        await sendNotificationToOwner(message, {
            inlineKeyboard: [
                [{ text: '🔍 Review & Approve', url: approvalsLink }],
            ],
        });
    } catch (error) {
        console.error('[registerUser] Failed to notify owner of pending signup:', error);
    }
}

// Export API endpoint name
export { register }; 