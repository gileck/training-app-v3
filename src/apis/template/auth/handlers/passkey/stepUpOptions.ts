import type { ApiHandlerContext, PasskeyStepUpOptionsResponse } from '../../types';
import * as credentials from '@/server/database/collections/template/credentials';
import { createWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { buildAuthenticationOptions } from '@/server/template/webauthn/ceremonies';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/browser';

/**
 * Step 1 of a step-up re-auth: issue an authentication assertion restricted to
 * the logged-in user's registered passkeys. A successful assertion proves the
 * current device is one of theirs, gating a sensitive page.
 */
export const passkeyStepUpOptionsHandler = async (
    _: unknown,
    context: ApiHandlerContext
): Promise<PasskeyStepUpOptionsResponse> => {
    try {
        if (!context.userId) return { error: 'Not authenticated' };

        const creds = await credentials.findCredentialsByUserId(context.userId);
        if (creds.length === 0) {
            return { error: 'No passkey is registered on this account. Add one in Profile → Passkeys.' };
        }

        const allowCredentials = creds.map((c) => ({
            id: c.credentialId,
            transports: c.transports as AuthenticatorTransportFuture[] | undefined,
        }));

        const { options, challenge } = await buildAuthenticationOptions({ allowCredentials });
        const stored = await createWebAuthnChallenge({
            challenge,
            purpose: 'authentication',
            userId: context.userId,
        });

        return { options, challengeId: stored._id.toString() };
    } catch (error: unknown) {
        console.error('Passkey step-up options error:', error);
        return { error: error instanceof Error ? error.message : 'Failed to start verification' };
    }
};
