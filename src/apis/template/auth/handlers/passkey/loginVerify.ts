import jwt from 'jsonwebtoken';
import type {
    ApiHandlerContext,
    PasskeyLoginVerifyRequest,
    PasskeyLoginVerifyResponse,
} from '../../types';
import * as users from '@/server/database/collections/template/users/users';
import * as credentials from '@/server/database/collections/template/credentials';
import { consumeWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { verifyAuthentication } from '@/server/template/webauthn/ceremonies';
import {
    COOKIE_NAME,
    COOKIE_OPTIONS,
    JWT_EXPIRES_IN,
    getJwtSecret,
    isAdminUser,
    sanitizeUser,
} from '../../shared';
import { toStringId } from '@/server/template/utils';
import { authOverrides } from '@/apis/auth-overrides';
import { recordSession } from '@/server/template/sessions/recordSession';

/**
 * Finish discoverable passkey login: verify the assertion against the stored
 * credential and — on success — issue the SAME JWT cookie session as password
 * login. Passkeys replace the credential, not the session, so everything
 * downstream of "issue JWT" is unchanged.
 *
 * Public endpoint (this IS the login). A generic error is returned for any
 * recognition/verification failure to avoid leaking which passkeys exist.
 */
export const passkeyLoginVerifyHandler = async (
    request: PasskeyLoginVerifyRequest,
    context: ApiHandlerContext
): Promise<PasskeyLoginVerifyResponse> => {
    const GENERIC_ERROR = 'Could not sign in with this passkey';
    try {
        if (!request?.challengeId || !request?.response) {
            return { error: GENERIC_ERROR };
        }

        // Single-use challenge for the authentication ceremony.
        const challenge = await consumeWebAuthnChallenge(request.challengeId, 'authentication');
        if (!challenge) {
            return { error: 'Login challenge expired — try again' };
        }

        // The assertion's credential id tells us which stored credential (and
        // therefore which user) is signing in.
        const stored = await credentials.findCredentialById(request.response.id);
        if (!stored) {
            return { error: GENERIC_ERROR };
        }

        const user = await users.findUserById(toStringId(stored.userId));
        if (!user) {
            return { error: GENERIC_ERROR };
        }

        const userId = toStringId(user._id);
        const isAdmin = isAdminUser(userId);

        // Same admin-approval gate as password login (admin bypasses).
        if (authOverrides.requireAdminApproval === true && !isAdmin) {
            const status = user.approvalStatus ?? 'approved';
            if (status === 'pending') {
                return { error: 'Your account is pending admin approval. You will be notified once approved.' };
            }
            if (status === 'rejected') {
                return { error: 'Your account has been rejected. Please contact the administrator.' };
            }
        }

        const result = await verifyAuthentication({
            response: request.response,
            expectedChallenge: challenge.challenge,
            credential: {
                credentialId: stored.credentialId,
                publicKey: stored.publicKey,
                counter: stored.counter,
            },
        });
        if (!result.verified) {
            return { error: GENERIC_ERROR };
        }

        // Persist the advanced signature counter (replay defense). A counter
        // that stays 0 is normal for synced platform authenticators.
        if (typeof result.newCounter === 'number') {
            await credentials.updateCredentialCounter(stored.credentialId, result.newCounter);
        }

        // Issue the JWT cookie session — identical to password login.
        const token = jwt.sign({ userId }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
        context.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);

        recordSession(userId, 'login');

        return { user: { ...sanitizeUser(user), isAdmin } };
    } catch (error: unknown) {
        console.error('Passkey login-verify error:', error);
        return { error: error instanceof Error ? error.message : GENERIC_ERROR };
    }
};
