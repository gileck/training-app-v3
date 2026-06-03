import type {
    ApiHandlerContext,
    PasskeyRegisterVerifyRequest,
    PasskeyRegisterVerifyResponse,
} from '../../types';
import * as credentials from '@/server/database/collections/template/credentials';
import { consumeWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { verifyRegistration } from '@/server/template/webauthn/ceremonies';
import { toPasskeyInfo } from './shared';

const MAX_DEVICE_NAME_LENGTH = 60;

/**
 * Finish the "add a passkey" ceremony: verify the attestation against the
 * stored challenge and persist the credential for the logged-in user.
 */
export const passkeyRegisterVerifyHandler = async (
    request: PasskeyRegisterVerifyRequest,
    context: ApiHandlerContext
): Promise<PasskeyRegisterVerifyResponse> => {
    try {
        if (!context.userId) {
            return { verified: false, error: 'Not authenticated' };
        }
        if (!request?.challengeId || !request?.response) {
            return { verified: false, error: 'Missing registration response' };
        }

        // Single-use: consume the challenge and bind it to THIS user.
        const challenge = await consumeWebAuthnChallenge(request.challengeId, 'registration');
        if (!challenge) {
            return { verified: false, error: 'Registration challenge expired — try again' };
        }
        if (!challenge.userId || challenge.userId.toString() !== context.userId) {
            return { verified: false, error: 'Registration challenge does not match this user' };
        }

        const result = await verifyRegistration({
            response: request.response,
            expectedChallenge: challenge.challenge,
        });
        if (!result.verified || !result.credential) {
            return { verified: false, error: 'Could not verify this passkey' };
        }

        // Guard against a credential id already in use (by anyone).
        const clash = await credentials.findCredentialById(result.credential.credentialId);
        if (clash) {
            return { verified: false, error: 'This passkey is already registered' };
        }

        const deviceName = request.deviceName?.trim().slice(0, MAX_DEVICE_NAME_LENGTH) || undefined;

        const stored = await credentials.insertCredential({
            userId: context.userId,
            credentialId: result.credential.credentialId,
            publicKey: result.credential.publicKey,
            counter: result.credential.counter,
            transports: result.credential.transports,
            backedUp: result.credential.backedUp,
            ...(deviceName ? { deviceName } : {}),
            createdAt: new Date(),
        });

        return { verified: true, passkey: toPasskeyInfo(stored) };
    } catch (error: unknown) {
        console.error('Passkey register-verify error:', error);
        return {
            verified: false,
            error: error instanceof Error ? error.message : 'Failed to register passkey',
        };
    }
};
