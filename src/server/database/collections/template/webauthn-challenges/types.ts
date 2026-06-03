import type { ObjectId } from 'mongodb';

export type WebAuthnChallengePurpose = 'registration' | 'authentication';

/**
 * A server-issued WebAuthn challenge, persisted between the two round-trips
 * of a ceremony (options → verify). Single-use and short-lived.
 *
 * For discoverable ("just tap") login there is no user yet, so the two
 * round-trips are correlated by `_id` (returned to the client as a
 * `challengeId` and echoed back on verify), not by userId.
 */
export interface WebAuthnChallenge {
    _id: ObjectId;
    /** Base64URL challenge value embedded in the ceremony options. */
    challenge: string;
    purpose: WebAuthnChallengePurpose;
    /** Present for registration / non-discoverable ceremonies. */
    userId?: ObjectId;
    createdAt: Date;
    expiresAt: Date;
    /** Set when redeemed — challenges are single-use. */
    consumedAt?: Date;
}

export type WebAuthnChallengeCreate = Omit<WebAuthnChallenge, '_id' | 'consumedAt'>;
