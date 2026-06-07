import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type {
    ApiHandlerContext,
    PasskeySignupOptionsRequest,
    PasskeySignupOptionsResponse,
} from '../../types';
import * as users from '@/server/database/collections/template/users/users';
import * as credentials from '@/server/database/collections/template/credentials';
import { createWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { buildRegistrationOptions } from '@/server/template/webauthn/ceremonies';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/browser';
import { SALT_ROUNDS } from '../../shared';
import { authOverrides } from '@/apis/auth-overrides';
import { isPasskeyMode } from '../../authMode';
import type { UserCreate } from '@/server/database/collections/template/users/types';

/**
 * Start self-service passkey sign-up (no session, no enrollment token).
 *
 * The username is the gate: it must be free, OR belong to a still-pending
 * account that has not finished registering a device yet (the resume case —
 * a user who abandoned the WebAuthn ceremony and is retrying). A username that
 * already maps to a real account (has credentials, or is approved) is rejected
 * as taken; a rejected account surfaces the rejection message.
 *
 * On success the account is created with `approvalStatus: 'pending'` (unless
 * admin approval is disabled, or this is the first-user bootstrap), and we
 * return registration options bound to the new user. The credential is only
 * stored — and the approval/session decision only made — in signup/verify.
 */
export const passkeySignupOptionsHandler = async (
    request: PasskeySignupOptionsRequest,
    context: ApiHandlerContext
): Promise<PasskeySignupOptionsResponse> => {
    try {
        if (!isPasskeyMode()) {
            return { error: 'Passkey sign-up is not enabled here.' };
        }

        const username = request?.username?.trim();
        if (!username) {
            return { error: 'Username is required' };
        }
        const email = request?.email?.trim() || undefined;

        // Project-level gate (blanket-disable, email-domain allowlist, etc.).
        // Passkey sign-up has no password, so pass an empty one — the shipped
        // override examples only inspect username/email.
        if (authOverrides.validateRegistration) {
            const overrideError = await authOverrides.validateRegistration({
                request: { username, password: '', ...(email && { email }) },
                context,
            });
            if (overrideError) {
                return { error: overrideError };
            }
        }

        // Resolve the username. We allow "resume" for a pending, credential-less
        // account so an abandoned ceremony doesn't permanently block the user.
        const existingByUsername = await users.findUserByUsername(username);
        let user = existingByUsername;

        if (existingByUsername) {
            if (existingByUsername.approvalStatus === 'rejected') {
                return { error: 'This account has been rejected. Please contact the administrator.' };
            }
            const existingCreds = await credentials.findCredentialsByUserId(
                existingByUsername._id.toString()
            );
            const isResumablePending =
                existingByUsername.approvalStatus === 'pending' && existingCreds.length === 0;
            if (!isResumablePending) {
                return { error: 'Username already exists' };
            }
            // Fall through and re-issue options for this same pending user.
        }

        if (!user) {
            // Brand-new account. Mirror registerUser's status logic: pending
            // unless approval is off or this is the first-user bootstrap.
            if (email) {
                const existingByEmail = await users.findUserByEmail(email);
                if (existingByEmail) {
                    if (existingByEmail.approvalStatus === 'rejected') {
                        return { error: 'This account has been rejected. Please contact the administrator.' };
                    }
                    return { error: 'Email already exists' };
                }
            }

            const requireApproval = authOverrides.requireAdminApproval === true;
            const isFirstUser = requireApproval && (await users.isUsersCollectionEmpty());

            // Passwordless account: store an unguessable random hash so the
            // password endpoints (if the deployment ever flips to AUTH_MODE=
            // password) can never authenticate this user.
            const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), SALT_ROUNDS);
            const now = new Date();
            const userData: UserCreate = {
                username,
                password_hash: passwordHash,
                createdAt: now,
                updatedAt: now,
                ...(email && { email }),
                // Mirror registerUser: pending under approval, EXCEPT the
                // first-user-wins bootstrap, which is stamped approved up front
                // (so the audit trail matches the normal approval path).
                ...(requireApproval && !isFirstUser && { approvalStatus: 'pending' }),
                ...(requireApproval && isFirstUser && { approvalStatus: 'approved', approvedAt: now }),
            };
            user = await users.insertUser(userData);

            if (isFirstUser) {
                console.log(
                    `[passkeySignupOptions] First-user-wins bootstrap: auto-approved "${user.username}" ` +
                    `(_id=${user._id.toString()}). Set ADMIN_USER_ID=${user._id.toString()} to grant admin access.`
                );
            }
        }

        const userId = user._id.toString();

        const existing = await credentials.findCredentialsByUserId(userId);
        const excludeCredentials = existing.map((c) => ({
            id: c.credentialId,
            transports: c.transports as AuthenticatorTransportFuture[] | undefined,
        }));

        const { options, challenge } = await buildRegistrationOptions({
            userId,
            userName: user.username,
            userDisplayName: user.username,
            excludeCredentials,
        });

        const stored = await createWebAuthnChallenge({
            challenge,
            purpose: 'registration',
            userId,
        });

        return { options, challengeId: stored._id.toString() };
    } catch (error: unknown) {
        console.error('Passkey signup-options error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to start sign-up',
        };
    }
};
