import type {
    ApiHandlerContext,
    PasskeyDeleteRequest,
    PasskeyDeleteResponse,
} from '../../types';
import * as credentials from '@/server/database/collections/template/credentials';

/**
 * Remove one of the logged-in user's passkeys. Scoped to the caller's userId
 * so a user can only delete their own credentials.
 */
export const passkeyDeleteHandler = async (
    request: PasskeyDeleteRequest,
    context: ApiHandlerContext
): Promise<PasskeyDeleteResponse> => {
    try {
        if (!context.userId) {
            return { success: false, error: 'Not authenticated' };
        }
        if (!request?.credentialId) {
            return { success: false, error: 'Missing credentialId' };
        }

        const deleted = await credentials.deleteCredential(request.credentialId, context.userId);
        if (!deleted) {
            return { success: false, error: 'Passkey not found' };
        }
        return { success: true };
    } catch (error: unknown) {
        console.error('Passkey delete error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete passkey',
        };
    }
};
