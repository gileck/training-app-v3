import jwt from 'jsonwebtoken';
import type {
    ApiHandlerContext,
    PasskeyEnrollVerifyRequest,
    PasskeyEnrollVerifyResponse,
} from '../../types';
import * as users from '@/server/database/collections/template/users/users';
import * as credentials from '@/server/database/collections/template/credentials';
import {
    findValidEnrollmentToken,
    consumeEnrollmentToken,
} from '@/server/database/collections/template/enrollment-tokens';
import { consumeWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { verifyRegistration } from '@/server/template/webauthn/ceremonies';
import {
    COOKIE_NAME,
    COOKIE_OPTIONS,
    JWT_EXPIRES_IN,
    getJwtSecret,
    isAdminUser,
    sanitizeUser,
} from '../../shared';
import { authOverrides } from '@/apis/auth-overrides';
import { recordSession } from '@/server/template/sessions/recordSession';
import { toPasskeyInfo } from './shared';

const MAX_DEVICE_NAME_LENGTH = 60;

/**
 * Finish token-authenticated enrollment: verify the attestation, store the
 * credential, consume the one-time enrollment token, and — if the user is
 * approved — issue the JWT session so they land logged in on this device.
 */
export const passkeyEnrollVerifyHandler = async (
    request: PasskeyEnrollVerifyRequest,
    context: ApiHandlerContext
): Promise<PasskeyEnrollVerifyResponse> => {
    try {
        if (!request?.token || !request?.challengeId || !request?.response) {
            return { verified: false, error: 'Missing enrollment data' };
        }

        const enrollToken = await findValidEnrollmentToken(request.token);
        if (!enrollToken) {
            return { verified: false, error: 'This enrollment link is invalid or has expired' };
        }
        const userId = enrollToken.userId.toString();

        // Single-use challenge, bound to the same user as the token.
        const challenge = await consumeWebAuthnChallenge(request.challengeId, 'registration');
        if (!challenge) {
            return { verified: false, error: 'Enrollment timed out — reload the page and try again' };
        }
        if (!challenge.userId || challenge.userId.toString() !== userId) {
            return { verified: false, error: 'Enrollment challenge does not match this link' };
        }

        const result = await verifyRegistration({
            response: request.response,
            expectedChallenge: challenge.challenge,
        });
        if (!result.verified || !result.credential) {
            return { verified: false, error: 'Could not verify this passkey' };
        }

        const clash = await credentials.findCredentialById(result.credential.credentialId);
        if (clash) {
            return { verified: false, error: 'This passkey is already registered' };
        }

        const user = await users.findUserById(userId);
        if (!user) {
            return { verified: false, error: 'This enrollment link is no longer valid' };
        }

        const deviceName = request.deviceName?.trim().slice(0, MAX_DEVICE_NAME_LENGTH) || undefined;
        const stored = await credentials.insertCredential({
            userId,
            credentialId: result.credential.credentialId,
            publicKey: result.credential.publicKey,
            counter: result.credential.counter,
            transports: result.credential.transports,
            backedUp: result.credential.backedUp,
            ...(deviceName ? { deviceName } : {}),
            createdAt: new Date(),
        });

        // Enrollment succeeded — burn the one-time token.
        await consumeEnrollmentToken(enrollToken._id);

        const passkey = toPasskeyInfo(stored);
        const isAdmin = isAdminUser(userId);

        // Only sign the user in if they're allowed to log in. An unapproved
        // user can still register the device, but can't get a session yet.
        if (authOverrides.requireAdminApproval === true && !isAdmin) {
            const status = user.approvalStatus ?? 'approved';
            if (status !== 'approved') {
                return { verified: true, passkey };
            }
        }

        const token = jwt.sign({ userId }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
        context.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);
        recordSession(userId, 'login');

        return { verified: true, passkey, user: { ...sanitizeUser(user), isAdmin } };
    } catch (error: unknown) {
        console.error('Passkey enroll-verify error:', error);
        return {
            verified: false,
            error: error instanceof Error ? error.message : 'Failed to register passkey',
        };
    }
};
