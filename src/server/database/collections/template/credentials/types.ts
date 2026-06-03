import type { ObjectId } from 'mongodb';

/**
 * A registered WebAuthn (passkey) credential bound to a user + device.
 *
 * One user can have many credentials (one per device / passkey provider).
 * `credentialId` is the unique, server-side lookup key returned by the
 * authenticator at registration and presented again on every assertion.
 */
export interface WebAuthnCredential {
    _id: ObjectId;
    userId: ObjectId;
    /** Base64URL credential ID from the authenticator. Unique lookup key. */
    credentialId: string;
    /** Base64URL-encoded COSE public key used to verify assertions. */
    publicKey: string;
    /**
     * Signature counter. Platform authenticators that sync via iCloud/Google
     * legitimately report 0 and never increment — a zero counter is NORMAL
     * and must not be treated as a clone/replay.
     */
    counter: number;
    /** Transport hints reported at registration (usb, nfc, ble, internal, hybrid). */
    transports?: string[];
    /** User-facing label shown in the device-management UI. */
    deviceName?: string;
    /** Whether the credential is backed up / synced across the provider's cloud. */
    backedUp?: boolean;
    createdAt: Date;
    lastUsedAt?: Date;
}

export type WebAuthnCredentialCreate = Omit<WebAuthnCredential, '_id'>;
