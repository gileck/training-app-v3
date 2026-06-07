import jwt from 'jsonwebtoken';
import type {
    ApiHandlerContext,
    PasskeySignupVerifyRequest,
    PasskeySignupVerifyResponse,
} from '../../types';
import * as users from '@/server/database/collections/template/users/users';
import * as credentials from '@/server/database/collections/template/credentials';
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
import { isPasskeyMode } from '../../authMode';
import { recordSession } from '@/server/template/sessions/recordSession';
import { sendNotificationToOwner } from '@/server/template/telegram';
import { getAppUrl } from '@/server/template/appUrl';
import { toPasskeyInfo } from './shared';

const MAX_DEVICE_NAME_LENGTH = 60;

/**
 * Finish self-service passkey sign-up: verify the attestation, store the first
 * credential, and decide the outcome exactly like password sign-up:
 *   - account still pending admin approval → `{ pendingApproval: true }`, no
 *     session (the client shows the waiting screen);
 *   - approved (admin approval disabled, first-user bootstrap, or the
 *     ADMIN_USER_ID bypass) → issue the JWT and return the user.
 *
 * Approval itself is a separate, downstream admin action — this handler never
 * approves anyone; it only registers the device and reports the current state.
 */
export const passkeySignupVerifyHandler = async (
    request: PasskeySignupVerifyRequest,
    context: ApiHandlerContext
): Promise<PasskeySignupVerifyResponse> => {
    try {
        if (!isPasskeyMode()) {
            return { verified: false, error: 'Passkey sign-up is not enabled here.' };
        }
        if (!request?.challengeId || !request?.response) {
            return { verified: false, error: 'Missing sign-up data' };
        }

        // Single-use challenge; it carries the user this ceremony was started for.
        const challenge = await consumeWebAuthnChallenge(request.challengeId, 'registration');
        if (!challenge || !challenge.userId) {
            return { verified: false, error: 'Sign-up timed out — reload the page and try again' };
        }
        const userId = challenge.userId.toString();

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
            return { verified: false, error: 'This sign-up is no longer valid' };
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

        const passkey = toPasskeyInfo(stored);
        const isAdmin = isAdminUser(userId);
        const requireApproval = authOverrides.requireAdminApproval === true;

        // Approval gate — identical to enroll/login. An unapproved user has now
        // registered their device but can't get a session until an admin
        // approves them. Notify the owner so they can review.
        if (requireApproval && !isAdmin) {
            const status = user.approvalStatus ?? 'approved';
            if (status !== 'approved') {
                await notifyOwnerOfPendingSignup(user.username, user.email);
                return { verified: true, passkey, pendingApproval: true };
            }
        }

        // We're issuing a session. If we only got here via the admin bypass on
        // a row that's still 'pending', stamp it approved (with approvedAt) so
        // it doesn't linger in /admin/approvals and the audit trail matches
        // registerUser. (First-user bootstrap was already stamped at signup.)
        let finalUser = user;
        if (requireApproval && (user.approvalStatus ?? 'approved') !== 'approved') {
            finalUser = (await users.setUserApprovalStatus(user._id, 'approved')) ?? user;
        }

        const token = jwt.sign({ userId }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
        context.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);
        recordSession(userId, 'register');

        return { verified: true, passkey, user: { ...sanitizeUser(finalUser), isAdmin } };
    } catch (error: unknown) {
        console.error('Passkey signup-verify error:', error);
        return {
            verified: false,
            error: error instanceof Error ? error.message : 'Failed to complete sign-up',
        };
    }
};

/**
 * Notify the owner via Telegram that a new passkey user is waiting for
 * approval. Best-effort and awaited (serverless can suspend right after the
 * response is written); a Telegram outage must not fail the sign-up.
 */
async function notifyOwnerOfPendingSignup(
    username: string,
    email: string | undefined
): Promise<void> {
    try {
        const appUrl = getAppUrl();
        const approvalsLink = appUrl ? `${appUrl}/admin/approvals` : null;

        const message = [
            '🆕 New passkey signup pending approval',
            '',
            `Username: ${username}`,
            email ? `Email: ${email}` : 'Email: (not provided)',
            ...(approvalsLink ? [] : ['', 'Open /admin/approvals to review.']),
        ].join('\n');

        await sendNotificationToOwner(message, {
            inlineKeyboard: approvalsLink
                ? [[{ text: '🔍 Review & Approve', url: approvalsLink }]]
                : undefined,
        });
    } catch (error) {
        console.error('[passkeySignupVerify] Failed to notify owner of pending signup:', error);
    }
}
