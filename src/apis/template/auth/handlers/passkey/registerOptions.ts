import type {
    ApiHandlerContext,
    PasskeyRegisterOptionsResponse,
} from '../../types';
import * as users from '@/server/database/collections/template/users/users';
import * as credentials from '@/server/database/collections/template/credentials';
import { createWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { buildRegistrationOptions } from '@/server/template/webauthn/ceremonies';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/browser';

/**
 * Start the "add a passkey" registration ceremony for the logged-in user.
 * Returns the options the browser feeds to `navigator.credentials.create()`
 * plus a `challengeId` the client echoes back on verify.
 */
export const passkeyRegisterOptionsHandler = async (
    _: unknown,
    context: ApiHandlerContext
): Promise<PasskeyRegisterOptionsResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }

        const user = await users.findUserById(context.userId);
        if (!user) {
            return { error: 'User not found' };
        }

        // Exclude already-registered credentials so the same device can't
        // enroll twice.
        const existing = await credentials.findCredentialsByUserId(context.userId);
        const excludeCredentials = existing.map((c) => ({
            id: c.credentialId,
            transports: c.transports as AuthenticatorTransportFuture[] | undefined,
        }));

        const { options, challenge } = await buildRegistrationOptions({
            userId: context.userId,
            userName: user.username,
            userDisplayName: user.username,
            excludeCredentials,
        });

        const stored = await createWebAuthnChallenge({
            challenge,
            purpose: 'registration',
            userId: context.userId,
        });

        return { options, challengeId: stored._id.toString() };
    } catch (error: unknown) {
        console.error('Passkey register-options error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to start passkey registration',
        };
    }
};
