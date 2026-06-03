import type { ApiHandlerContext } from '@/apis/template/auth/types';
import * as credentials from '@/server/database/collections/template/credentials';
import { createWebAuthnChallenge } from '@/server/database/collections/template/webauthn-challenges';
import { buildAuthenticationOptions } from '@/server/template/webauthn/ceremonies';
import { isDaemonAlive } from '@/server/database/collections/template/rpc-daemon-status/daemon-status';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/browser';
import type { ConnectOptionsResponse } from '../types';

/**
 * Step 1 of passkey device-auth connect: issue an authentication assertion
 * restricted to the admin's registered passkeys. A successful assertion in
 * step 2 proves the current device is registered — replacing Telegram approval.
 */
export const connectOptions = async (
  _request: unknown,
  context: ApiHandlerContext
): Promise<ConnectOptionsResponse> => {
  try {
    if (!context.userId) return { error: 'Not authenticated' };

    // Don't prompt for Face ID if the session couldn't run anything anyway.
    if (!(await isDaemonAlive())) {
      return { error: 'RPC daemon is offline. Start it with `yarn daemon` before connecting.' };
    }

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
    console.error('RPC connect-options error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to start device verification' };
  }
};
