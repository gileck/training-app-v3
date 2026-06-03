/**
 * Thin server-side wrappers around SimpleWebAuthn's ceremonies, with this
 * deployment's RP config (rpID / rpName / origin) applied centrally so
 * handlers never repeat it.
 *
 * - Registration (Phase 1): enroll a passkey for a logged-in user.
 * - Authentication (Phase 2): discoverable "just tap" login.
 */

import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
    AuthenticationResponseJSON,
    AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { getWebAuthnConfig } from './config';

export interface RegistrationOptionsResult {
    options: PublicKeyCredentialCreationOptionsJSON;
    /** The challenge embedded in the options — persist it to verify later. */
    challenge: string;
}

/**
 * Build registration options for a known (logged-in) user.
 *
 * `residentKey: 'required'` makes the credential **discoverable**, which is
 * what enables the later "just tap" usernameless login — the credential
 * stores the user handle on the device so the browser can offer it without
 * us first naming a user.
 */
export async function buildRegistrationOptions(input: {
    userId: string;
    userName: string;
    userDisplayName?: string;
    /** Already-registered credentials, so the user can't double-register one. */
    excludeCredentials?: { id: string; transports?: AuthenticatorTransportFuture[] }[];
}): Promise<RegistrationOptionsResult> {
    const { rpID, rpName } = getWebAuthnConfig();
    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userName: input.userName,
        // userID must be a byte array (<=64 bytes); the Mongo id hex string fits.
        userID: new TextEncoder().encode(input.userId),
        userDisplayName: input.userDisplayName ?? input.userName,
        attestationType: 'none',
        excludeCredentials: input.excludeCredentials ?? [],
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'preferred',
        },
    });
    return { options, challenge: options.challenge };
}

export interface VerifiedRegistration {
    verified: boolean;
    credential?: {
        credentialId: string;
        /** Base64URL-encoded COSE public key, ready to store. */
        publicKey: string;
        counter: number;
        transports?: string[];
        backedUp: boolean;
    };
}

export async function verifyRegistration(input: {
    response: RegistrationResponseJSON;
    expectedChallenge: string;
}): Promise<VerifiedRegistration> {
    const { rpID, expectedOrigin } = getWebAuthnConfig();
    const verification = await verifyRegistrationResponse({
        response: input.response,
        expectedChallenge: input.expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        // Platform authenticators may report UV as preferred, not required —
        // don't hard-fail registration on it.
        requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
        return { verified: false };
    }

    const { credential, credentialBackedUp } = verification.registrationInfo;
    return {
        verified: true,
        credential: {
            credentialId: credential.id,
            publicKey: isoBase64URL.fromBuffer(credential.publicKey),
            counter: credential.counter,
            transports: credential.transports,
            backedUp: credentialBackedUp,
        },
    };
}

// ============================================================
// Authentication ceremony (Phase 2 — discoverable login)
// ============================================================

export interface AuthenticationOptionsResult {
    options: PublicKeyCredentialRequestOptionsJSON;
    /** The challenge embedded in the options — persist it to verify later. */
    challenge: string;
}

/**
 * Build authentication options.
 *
 * - **Discoverable login** (default): empty `allowCredentials`, so the browser
 *   offers whatever passkeys it holds for this rpID and the user just taps one.
 * - **Restricted** (pass `allowCredentials`): used when the user is already
 *   known (e.g. device verification for an RPC connection) — the assertion is
 *   limited to that user's registered credentials, proving the current device
 *   holds one of them.
 */
export async function buildAuthenticationOptions(input?: {
    allowCredentials?: { id: string; transports?: AuthenticatorTransportFuture[] }[];
}): Promise<AuthenticationOptionsResult> {
    const { rpID } = getWebAuthnConfig();
    const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: input?.allowCredentials ?? [],
        userVerification: 'preferred',
    });
    return { options, challenge: options.challenge };
}

export interface VerifiedAuthentication {
    verified: boolean;
    /** Post-assertion signature counter to persist back to the credential. */
    newCounter?: number;
}

export async function verifyAuthentication(input: {
    response: AuthenticationResponseJSON;
    expectedChallenge: string;
    /** The stored credential this assertion claims to be from. */
    credential: { credentialId: string; publicKey: string; counter: number };
}): Promise<VerifiedAuthentication> {
    const { rpID, expectedOrigin } = getWebAuthnConfig();
    const verification = await verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: input.expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
            id: input.credential.credentialId,
            publicKey: isoBase64URL.toBuffer(input.credential.publicKey),
            counter: input.credential.counter,
        },
        requireUserVerification: false,
    });

    if (!verification.verified) {
        return { verified: false };
    }
    return { verified: true, newCounter: verification.authenticationInfo.newCounter };
}
