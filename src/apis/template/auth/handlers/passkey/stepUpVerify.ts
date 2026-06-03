import type {
    ApiHandlerContext,
    PasskeyStepUpVerifyRequest,
    PasskeyStepUpVerifyResponse,
} from '../../types';
import * as credentials from '@/server/database/collections/template/credentials';
import { consumeWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { verifyAuthentication } from '@/server/template/webauthn/ceremonies';

/**
 * Step 2 of a step-up re-auth: verify the assertion against the logged-in
 * user's stored credential. On success the device is proven — the caller may
 * reveal the guarded content. Stateless: returns `{ verified, verifiedAt }`;
 * the client gates the UI (it does not change the session).
 */
export const passkeyStepUpVerifyHandler = async (
    request: PasskeyStepUpVerifyRequest,
    context: ApiHandlerContext
): Promise<PasskeyStepUpVerifyResponse> => {
    try {
        if (!context.userId) return { verified: false, error: 'Not authenticated' };
        if (!request?.challengeId || !request?.response) {
            return { verified: false, error: 'Missing assertion' };
        }

        const challenge = await consumeWebAuthnChallenge(request.challengeId, 'authentication');
        if (!challenge) {
            return { verified: false, error: 'Verification expired — try again.' };
        }
        if (!challenge.userId || challenge.userId.toString() !== context.userId) {
            return { verified: false, error: 'Verification does not match this user.' };
        }

        const stored = await credentials.findCredentialById(request.response.id);
        if (!stored || stored.userId.toString() !== context.userId) {
            return { verified: false, error: 'This device is not registered to your account.' };
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
            return { verified: false, error: 'Could not verify your passkey.' };
        }
        if (typeof result.newCounter === 'number') {
            await credentials.updateCredentialCounter(stored.credentialId, result.newCounter);
        }

        return { verified: true, verifiedAt: new Date().toISOString() };
    } catch (error: unknown) {
        console.error('Passkey step-up verify error:', error);
        return { verified: false, error: error instanceof Error ? error.message : 'Failed to verify' };
    }
};
