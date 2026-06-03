import type { ApiHandlerContext } from '@/apis/template/auth/types';
import * as credentials from '@/server/database/collections/template/credentials';
import { consumeWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { verifyAuthentication } from '@/server/template/webauthn/ceremonies';
import {
  createApprovedRpcConnection,
  endActiveConnectionForUser,
  expireStaleConnectionForUser,
} from '@/server/database/collections/template/rpc-connections/rpc-connections';
import { isDaemonAlive } from '@/server/database/collections/template/rpc-daemon-status/daemon-status';
import { RPC_CONNECTION_TTL_MS } from '@/server/template/rpc/config';
import type { ConnectVerifyRequest, ConnectVerifyResponse } from '../types';
import { toRpcConnectionView } from './shared';

/**
 * Step 2 of passkey device-auth connect: verify the assertion against the
 * user's stored credential. On success the device is proven registered, so we
 * open an ALREADY-APPROVED connection (no Telegram), bound to the verified
 * credential.
 */
export const connectVerify = async (
  request: ConnectVerifyRequest,
  context: ApiHandlerContext
): Promise<ConnectVerifyResponse> => {
  try {
    if (!context.userId) return { error: 'Not authenticated' };
    if (!request?.challengeId || !request?.response) {
      return { error: 'Missing device assertion' };
    }

    const challenge = await consumeWebAuthnChallenge(request.challengeId, 'authentication');
    if (!challenge) {
      return { error: 'Device check expired — try connecting again.' };
    }
    if (!challenge.userId || challenge.userId.toString() !== context.userId) {
      return { error: 'Device check does not match this user.' };
    }

    // The assertion's credential must be a registered passkey of THIS user.
    const stored = await credentials.findCredentialById(request.response.id);
    if (!stored || stored.userId.toString() !== context.userId) {
      return { error: 'This device is not registered to your account.' };
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
      return { error: 'Could not verify this device.' };
    }
    if (typeof result.newCounter === 'number') {
      await credentials.updateCredentialCounter(stored.credentialId, result.newCounter);
    }

    // Re-check the daemon (time passed during the Face ID prompt).
    if (!(await isDaemonAlive())) {
      return { error: 'RPC daemon is offline. Start it with `yarn daemon` before connecting.' };
    }

    // Supersede any prior active row, then open an approved session.
    await expireStaleConnectionForUser(context.userId);
    await endActiveConnectionForUser(context.userId, 'user_stop');

    const connection = await createApprovedRpcConnection({
      userId: context.userId,
      userAgent: context.userAgent ?? 'unknown',
      ip: context.ip ?? 'unknown',
      ttlMs: RPC_CONNECTION_TTL_MS,
      approvalMethod: 'passkey',
      credentialId: stored.credentialId,
    });

    return {
      connection: toRpcConnectionView(connection),
      clientToken: connection.clientToken,
    };
  } catch (error: unknown) {
    console.error('RPC connect-verify error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to verify device' };
  }
};
