import type { ApiHandlerContext, PasskeyListResponse } from '../../types';
import * as credentials from '@/server/database/collections/template/credentials';
import { toPasskeyInfo } from './shared';

/** List the logged-in user's registered passkeys (device management). */
export const passkeyListHandler = async (
    _: unknown,
    context: ApiHandlerContext
): Promise<PasskeyListResponse> => {
    try {
        if (!context.userId) {
            return { error: 'Not authenticated' };
        }
        const list = await credentials.findCredentialsByUserId(context.userId);
        return { passkeys: list.map(toPasskeyInfo) };
    } catch (error: unknown) {
        console.error('Passkey list error:', error);
        return {
            error: error instanceof Error ? error.message : 'Failed to list passkeys',
        };
    }
};
