/**
 * Enroll Passkey Route Hooks
 *
 * Token-authenticated passkey enrollment opened from a magic link. The options
 * query validates the link + prepares the ceremony; the complete mutation runs
 * the OS authenticator and stores the credential, adopting the issued session
 * if the server logs the user in.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import {
    startRegistration,
    browserSupportsWebAuthn,
    WebAuthnError,
} from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import {
    apiPasskeyEnrollOptions,
    apiPasskeyEnrollVerify,
} from '@/apis/template/auth/client';
import type { PasskeyEnrollVerifyResponse } from '@/apis/template/auth/types';
import { useAuthStore, userToHint } from '@/client/features';

export interface EnrollPreparedOptions {
    options: PublicKeyCredentialCreationOptionsJSON;
    challengeId: string;
    username?: string;
}

export function browserSupportsPasskeys(): boolean {
    return typeof window !== 'undefined' && browserSupportsWebAuthn();
}

export function useEnrollOptions(token: string | undefined) {
    return useQuery<EnrollPreparedOptions>({
        queryKey: ['passkey-enroll', token],
        enabled: !!token,
        // The link is one-shot per visit; don't silently refetch and spawn
        // stray challenges. Retries are explicit (refetch on "Try again").
        staleTime: Infinity,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
        queryFn: async (): Promise<EnrollPreparedOptions> => {
            const result = await apiPasskeyEnrollOptions({ token: token as string });
            if (result.data?.error) {
                throw new Error(result.data.error);
            }
            const { options, challengeId, username } = result.data ?? {};
            if (!options || !challengeId) {
                throw new Error('This enrollment link is invalid or has expired');
            }
            return { options, challengeId, username };
        },
    });
}

export function useCompleteEnroll() {
    const { setValidatedUser, setUserHint } = useAuthStore();
    return useMutation<PasskeyEnrollVerifyResponse, Error, EnrollPreparedOptions & { token: string }>({
        mutationFn: async ({ token, options, challengeId }): Promise<PasskeyEnrollVerifyResponse> => {
            if (!browserSupportsPasskeys()) {
                throw new Error('This browser does not support passkeys');
            }

            let attestation;
            try {
                attestation = await startRegistration({ optionsJSON: options });
            } catch (err) {
                if (err instanceof WebAuthnError) {
                    if (err.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') {
                        throw new Error('A passkey for this device is already registered');
                    }
                    if (err.code === 'ERROR_CEREMONY_ABORTED') {
                        throw new Error('Passkey setup was cancelled');
                    }
                }
                throw err instanceof Error ? err : new Error('Passkey setup failed');
            }

            const result = await apiPasskeyEnrollVerify({
                token,
                challengeId,
                response: attestation,
            });
            if (result.data?.error) {
                throw new Error(result.data.error);
            }
            if (!result.data?.verified) {
                throw new Error('Could not verify this passkey');
            }
            return result.data;
        },
        onSuccess: (data) => {
            // The server signs approved users in — adopt the session so the
            // app boots straight into the authenticated experience.
            if (data.user) {
                setValidatedUser(data.user);
                setUserHint(userToHint(data.user));
            }
        },
    });
}
