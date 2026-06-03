import type { PasskeyEnrollOptionsRequest, PasskeyEnrollOptionsResponse } from '../../types';
import * as users from '@/server/database/collections/template/users/users';
import * as credentials from '@/server/database/collections/template/credentials';
import { findValidEnrollmentToken } from '@/server/database/collections/template/enrollment-tokens';
import { createWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { buildRegistrationOptions } from '@/server/template/webauthn/ceremonies';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/browser';

/**
 * Start enrollment from an enrollment-link token (no session required). The
 * token identifies the user; we build registration options for them. The
 * token is NOT consumed here — only on successful verify — so the page can
 * retry if the WebAuthn challenge times out.
 */
export const passkeyEnrollOptionsHandler = async (
    request: PasskeyEnrollOptionsRequest
): Promise<PasskeyEnrollOptionsResponse> => {
    try {
        if (!request?.token) {
            return { error: 'Missing enrollment token' };
        }

        const enrollToken = await findValidEnrollmentToken(request.token);
        if (!enrollToken) {
            return { error: 'This enrollment link is invalid or has expired' };
        }

        const userId = enrollToken.userId.toString();
        const user = await users.findUserById(userId);
        if (!user) {
            return { error: 'This enrollment link is no longer valid' };
        }

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

        return { options, challengeId: stored._id.toString(), username: user.username };
    } catch (error: unknown) {
        console.error('Passkey enroll-options error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to start enrollment',
        };
    }
};
