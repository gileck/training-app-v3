import type { WebAuthnCredential } from '@/server/database/collections/template/credentials/types';
import type { PasskeyInfo } from '../../types';

/** Serialize a stored credential into the client-facing device-list shape. */
export function toPasskeyInfo(credential: WebAuthnCredential): PasskeyInfo {
    return {
        credentialId: credential.credentialId,
        deviceName: credential.deviceName,
        backedUp: credential.backedUp,
        createdAt: credential.createdAt.toISOString(),
        lastUsedAt: credential.lastUsedAt?.toISOString(),
    };
}
