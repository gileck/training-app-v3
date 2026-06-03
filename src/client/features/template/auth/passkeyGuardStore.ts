/**
 * Passkey Guard Store
 *
 * Tracks which guarded pages the user has unlocked via a passkey step-up, and
 * until when. Keyed by an arbitrary `guardKey` so different sensitive pages
 * have independent unlock windows.
 *
 * IN-MEMORY ONLY (never persisted) — unlock state must not survive a reload or
 * a new tab, so sensitive pages always re-prompt after the app restarts.
 */

import { createStore } from '@/client/stores';

interface PasskeyGuardState {
    /** guardKey → epoch ms until which the page is considered unlocked. */
    verifiedUntil: Record<string, number>;
    markVerified: (key: string, ttlMs: number) => void;
    clearVerified: (key: string) => void;
    clearAll: () => void;
}

export const usePasskeyGuardStore = createStore<PasskeyGuardState>({
    key: 'passkey-guard',
    label: 'Passkey Guard',
    inMemoryOnly: true,
    creator: (set) => ({
        verifiedUntil: {},
        markVerified: (key, ttlMs) =>
            set((state) => ({
                verifiedUntil: { ...state.verifiedUntil, [key]: Date.now() + ttlMs },
            })),
        clearVerified: (key) =>
            set((state) => {
                const next = { ...state.verifiedUntil };
                delete next[key];
                return { verifiedUntil: next };
            }),
        clearAll: () => set({ verifiedUntil: {} }),
    }),
});

/** True if `key` is currently unlocked (verified and within its TTL). */
export function useIsGuardVerified(key: string): boolean {
    return usePasskeyGuardStore((state) => {
        const until = state.verifiedUntil[key];
        return typeof until === 'number' && until > Date.now();
    });
}
