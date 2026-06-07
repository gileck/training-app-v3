/**
 * Passkey (WebAuthn) Feature Hooks
 *
 * React Query hooks for enrolling and managing passkeys for the logged-in
 * user. These are genuine server+device interactions (the OS authenticator
 * prompt happens mid-flight), so they are NOT optimistic — the credential
 * list is the server's source of truth and is refetched after each change.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    startRegistration,
    startAuthentication,
    browserSupportsWebAuthn,
    WebAuthnError,
} from '@simplewebauthn/browser';
import {
    apiPasskeyRegisterOptions,
    apiPasskeyRegisterVerify,
    apiPasskeyList,
    apiPasskeyRename,
    apiPasskeyDelete,
    apiPasskeyLoginOptions,
    apiPasskeyLoginVerify,
    apiPasskeySignupOptions,
    apiPasskeySignupVerify,
    apiPasskeyStepUpOptions,
    apiPasskeyStepUpVerify,
} from '@/apis/template/auth/client';
import type { PasskeyInfo, UserResponse } from '@/apis/template/auth/types';
import { useQueryDefaults } from '@/client/query';
import { useAuthStore } from './store';
import { userToHint } from './types';

export const passkeysQueryKey = ['passkeys'] as const;

export function usePasskeys(options?: { enabled?: boolean }) {
    const defaults = useQueryDefaults();
    return useQuery<PasskeyInfo[]>({
        ...defaults,
        queryKey: passkeysQueryKey,
        enabled: options?.enabled ?? true,
        queryFn: async (): Promise<PasskeyInfo[]> => {
            const response = await apiPasskeyList();
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.passkeys ?? [];
        },
    });
}

/** True if this browser can do WebAuthn at all (gate the "Add" button). */
export function browserSupportsPasskeys(): boolean {
    return typeof window !== 'undefined' && browserSupportsWebAuthn();
}

/**
 * Run the full registration ceremony: fetch options → invoke the OS
 * authenticator → verify + store. Resolves with the newly stored passkey.
 */
export function useAddPasskey() {
    const queryClient = useQueryClient();
    return useMutation<PasskeyInfo, Error, { deviceName?: string } | void>({
        mutationFn: async (vars): Promise<PasskeyInfo> => {
            if (!browserSupportsPasskeys()) {
                throw new Error('This browser does not support passkeys');
            }

            const optionsResponse = await apiPasskeyRegisterOptions();
            if (!optionsResponse.data || Object.keys(optionsResponse.data).length === 0) {
                throw new Error('You must be online to add a passkey');
            }
            if (optionsResponse.data.error) {
                throw new Error(optionsResponse.data.error);
            }
            const { options, challengeId } = optionsResponse.data;
            if (!options || !challengeId) {
                throw new Error('Failed to start passkey registration');
            }

            let attestation;
            try {
                attestation = await startRegistration({ optionsJSON: options });
            } catch (err) {
                // Map the common ceremony failures to friendlier messages.
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

            const verifyResponse = await apiPasskeyRegisterVerify({
                challengeId,
                response: attestation,
                deviceName: vars?.deviceName,
            });
            if (verifyResponse.data?.error) {
                throw new Error(verifyResponse.data.error);
            }
            if (!verifyResponse.data?.verified || !verifyResponse.data.passkey) {
                throw new Error('Could not verify this passkey');
            }
            return verifyResponse.data.passkey;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: passkeysQueryKey });
        },
    });
}

/**
 * Discoverable "just tap" login: ask the browser to offer whatever passkeys
 * it holds for this site, verify the chosen one, and — on success — adopt the
 * issued session exactly like password login (validated user + instant-boot
 * hint).
 */
export function usePasskeyLogin() {
    const { setValidatedUser, setUserHint, setError } = useAuthStore();
    return useMutation<UserResponse, Error, void>({
        mutationFn: async (): Promise<UserResponse> => {
            if (!browserSupportsPasskeys()) {
                throw new Error('This browser does not support passkeys');
            }

            const optionsResponse = await apiPasskeyLoginOptions();
            if (!optionsResponse.data || Object.keys(optionsResponse.data).length === 0) {
                throw new Error('You must be online to sign in with a passkey');
            }
            if (optionsResponse.data.error) {
                throw new Error(optionsResponse.data.error);
            }
            const { options, challengeId } = optionsResponse.data;
            if (!options || !challengeId) {
                throw new Error('Failed to start passkey login');
            }

            let assertion;
            try {
                assertion = await startAuthentication({ optionsJSON: options });
            } catch (err) {
                if (err instanceof WebAuthnError && err.code === 'ERROR_CEREMONY_ABORTED') {
                    throw new Error('Passkey sign-in was cancelled');
                }
                throw err instanceof Error ? err : new Error('Passkey sign-in failed');
            }

            const verifyResponse = await apiPasskeyLoginVerify({ challengeId, response: assertion });
            if (verifyResponse.data?.error) {
                throw new Error(verifyResponse.data.error);
            }
            if (!verifyResponse.data?.user) {
                throw new Error('Could not sign in with this passkey');
            }
            return verifyResponse.data.user;
        },
        onSuccess: (user) => {
            setValidatedUser(user);
            setUserHint(userToHint(user));
        },
        onError: (error) => {
            setError(error instanceof Error ? error.message : 'Passkey sign-in failed');
        },
    });
}

/**
 * Result of a self-service passkey sign-up:
 * - { kind: 'authenticated', user } — approved + logged in on this device
 * - { kind: 'pending-approval' }    — account + passkey created, awaiting admin
 */
export type PasskeySignupResult =
    | { kind: 'authenticated'; user: UserResponse }
    | { kind: 'pending-approval' };

/**
 * Self-service sign-up with a passkey: create the account (username-gated),
 * register this device, and either adopt the issued session (approved) or
 * surface the pending-approval state. Mirrors `useRegister` so `LoginForm`
 * can share the same waiting screen.
 */
export function usePasskeySignup() {
    const { setValidatedUser, setUserHint, setError } = useAuthStore();
    return useMutation<PasskeySignupResult, Error, { username: string; email?: string }>({
        mutationFn: async ({ username, email }): Promise<PasskeySignupResult> => {
            if (!browserSupportsPasskeys()) {
                throw new Error('This browser does not support passkeys');
            }

            const optionsResponse = await apiPasskeySignupOptions({ username, ...(email ? { email } : {}) });
            if (!optionsResponse.data || Object.keys(optionsResponse.data).length === 0) {
                throw new Error('You must be online to sign up');
            }
            if (optionsResponse.data.error) {
                throw new Error(optionsResponse.data.error);
            }
            const { options, challengeId } = optionsResponse.data;
            if (!options || !challengeId) {
                throw new Error('Failed to start sign-up');
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
                        throw new Error('Sign-up was cancelled');
                    }
                }
                throw err instanceof Error ? err : new Error('Sign-up failed');
            }

            const verifyResponse = await apiPasskeySignupVerify({ challengeId, response: attestation });
            if (verifyResponse.data?.error) {
                throw new Error(verifyResponse.data.error);
            }
            if (verifyResponse.data?.pendingApproval) {
                return { kind: 'pending-approval' };
            }
            if (!verifyResponse.data?.user) {
                throw new Error('Could not complete sign-up');
            }
            return { kind: 'authenticated', user: verifyResponse.data.user };
        },
        onSuccess: (result) => {
            if (result.kind === 'authenticated') {
                setValidatedUser(result.user);
                setUserHint(userToHint(result.user));
            }
            // pending-approval: LoginForm reads mutation.data and shows the
            // waiting screen — nothing to do here.
        },
        onError: (error) => {
            setError(error instanceof Error ? error.message : 'Sign-up failed');
        },
    });
}

export function useRenamePasskey() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, { credentialId: string; deviceName: string }>({
        mutationFn: async ({ credentialId, deviceName }): Promise<void> => {
            const response = await apiPasskeyRename({ credentialId, deviceName });
            if (!response.data || Object.keys(response.data).length === 0) {
                throw new Error('You must be online to rename a passkey');
            }
            if (response.data.error) {
                throw new Error(response.data.error);
            }
            if (!response.data.success) {
                throw new Error('Failed to rename passkey');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: passkeysQueryKey });
        },
    });
}

/**
 * Step-up re-authentication: prompt for a fresh passkey assertion to confirm
 * the current device is the user's, without changing the session. Used to gate
 * sensitive pages (see PasskeyGuard). Resolves on success, rejects otherwise.
 */
export function usePasskeyStepUp() {
    return useMutation<void, Error, void>({
        mutationFn: async (): Promise<void> => {
            if (!browserSupportsPasskeys()) {
                throw new Error('This browser does not support passkeys');
            }

            const optionsRes = await apiPasskeyStepUpOptions();
            const od = optionsRes.data;
            if (!od || Object.keys(od).length === 0) {
                throw new Error('You must be online to verify');
            }
            if (od.error) throw new Error(od.error);
            if (!od.options || !od.challengeId) {
                throw new Error('Failed to start verification');
            }

            let assertion;
            try {
                assertion = await startAuthentication({ optionsJSON: od.options });
            } catch (err) {
                if (err instanceof WebAuthnError && err.code === 'ERROR_CEREMONY_ABORTED') {
                    throw new Error('Verification was cancelled');
                }
                throw err instanceof Error ? err : new Error('Verification failed');
            }

            const verifyRes = await apiPasskeyStepUpVerify({
                challengeId: od.challengeId,
                response: assertion,
            });
            const vd = verifyRes.data;
            if (vd?.error) throw new Error(vd.error);
            if (!vd?.verified) throw new Error('Could not verify your passkey');
        },
    });
}

export function useDeletePasskey() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, { credentialId: string }>({
        mutationFn: async ({ credentialId }): Promise<void> => {
            const response = await apiPasskeyDelete({ credentialId });
            if (!response.data || Object.keys(response.data).length === 0) {
                throw new Error('You must be online to remove a passkey');
            }
            if (response.data.error) {
                throw new Error(response.data.error);
            }
            if (!response.data.success) {
                throw new Error('Failed to remove passkey');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: passkeysQueryKey });
        },
    });
}
