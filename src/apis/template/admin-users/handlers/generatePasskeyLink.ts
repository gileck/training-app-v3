import { requireAppUrl } from '@/server/template/appUrl';
import * as users from '@/server/database/collections/template/users/users';
import {
  createEnrollmentToken,
  invalidateAllEnrollmentTokensForUser,
} from '@/server/database/collections/template/enrollment-tokens';
import type {
  GeneratePasskeyLinkRequest,
  GeneratePasskeyLinkResponse,
} from '../types';

/**
 * Mint a one-time passkey-enrollment URL for a user. This is the SAME link
 * the user would receive by email once SES is wired — admin generation is
 * just an alternate delivery channel for the same enrollment token.
 *
 * Admin-gated automatically by the `admin/` name prefix (processApiCall).
 * Regenerating invalidates any prior outstanding link for the user, so only
 * the most recent link works.
 */
export const generatePasskeyLink = async (
  request: GeneratePasskeyLinkRequest
): Promise<GeneratePasskeyLinkResponse> => {
  try {
    if (!request?.userId) {
      return { error: 'Missing userId' };
    }
    const user = await users.findUserById(request.userId);
    if (!user) {
      return { error: 'User not found' };
    }

    await invalidateAllEnrollmentTokensForUser(user._id);
    const { rawToken, token } = await createEnrollmentToken(user._id);

    const url = `${requireAppUrl()}/enroll-passkey?token=${rawToken}`;

    return { url, expiresAt: token.expiresAt.toISOString() };
  } catch (error: unknown) {
    console.error('Generate passkey link error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to generate passkey link',
    };
  }
};
