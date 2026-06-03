import type { ObjectId } from 'mongodb';

/**
 * A magic-link token authorizing "enroll a passkey on this device" for a
 * user. Emailed as a one-time link and consumed when the enroll page opens
 * the registration ceremony. This single token type backs the whole
 * universal enrollment flow: signup, add-device, recovery, and migration.
 *
 * Mirrors the password-reset-token pattern: only the SHA-256 hash of the raw
 * token is stored — the raw value lives only in the emailed link.
 */
export interface EnrollmentToken {
    _id: ObjectId;
    userId: ObjectId;
    /** SHA-256 hash of the raw token. Raw value is never stored. */
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
    /** Set when redeemed — single-use. */
    consumedAt?: Date;
}

export type EnrollmentTokenCreate = Omit<EnrollmentToken, '_id' | 'consumedAt'>;
