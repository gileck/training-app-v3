import type {
    ApiHandlerContext,
    PasskeyRenameRequest,
    PasskeyRenameResponse,
} from '../../types';
import * as credentials from '@/server/database/collections/template/credentials';

const MAX_DEVICE_NAME_LENGTH = 60;

/**
 * Relabel one of the logged-in user's passkeys. Scoped to the caller's userId
 * so a user can only rename their own credentials.
 */
export const passkeyRenameHandler = async (
    request: PasskeyRenameRequest,
    context: ApiHandlerContext
): Promise<PasskeyRenameResponse> => {
    try {
        if (!context.userId) {
            return { success: false, error: 'Not authenticated' };
        }
        const deviceName = request?.deviceName?.trim().slice(0, MAX_DEVICE_NAME_LENGTH);
        if (!request?.credentialId || !deviceName) {
            return { success: false, error: 'Name is required' };
        }

        const renamed = await credentials.renameCredential(
            request.credentialId,
            context.userId,
            deviceName
        );
        if (!renamed) {
            return { success: false, error: 'Passkey not found' };
        }
        return { success: true };
    } catch (error: unknown) {
        console.error('Passkey rename error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to rename passkey',
        };
    }
};
