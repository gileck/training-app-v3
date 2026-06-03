import type { PasskeyLoginOptionsResponse } from '../../types';
import { createWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { buildAuthenticationOptions } from '@/server/template/webauthn/ceremonies';

/**
 * Start a discoverable ("just tap") passkey login. Public — there is no user
 * yet; the challenge is correlated to the verify step by `challengeId` alone.
 */
export const passkeyLoginOptionsHandler = async (): Promise<PasskeyLoginOptionsResponse> => {
    try {
        const { options, challenge } = await buildAuthenticationOptions();
        const stored = await createWebAuthnChallenge({
            challenge,
            purpose: 'authentication',
        });
        return { options, challengeId: stored._id.toString() };
    } catch (error: unknown) {
        console.error('Passkey login-options error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to start passkey login',
        };
    }
};
