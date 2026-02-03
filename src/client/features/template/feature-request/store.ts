/**
 * Feature Request Store
 *
 * Manages the feature request dialog open state.
 */

import { createStore } from '@/client/stores';

interface FeatureRequestState {
    isOpen: boolean;

    // Actions
    openDialog: () => void;
    closeDialog: () => void;
}

export const useFeatureRequestStore = createStore<FeatureRequestState>({
    key: 'feature-request',
    label: 'Feature Request',
    inMemoryOnly: true,
    creator: (set) => ({
        isOpen: false,

        openDialog: () => {
            set({ isOpen: true });
        },

        closeDialog: () => {
            set({ isOpen: false });
        },
    }),
});

// Selector hooks
export function useFeatureRequestDialogOpen(): boolean {
    return useFeatureRequestStore((state) => state.isOpen);
}

export function useOpenFeatureRequestDialog() {
    return useFeatureRequestStore((state) => state.openDialog);
}

export function useCloseFeatureRequestDialog() {
    return useFeatureRequestStore((state) => state.closeDialog);
}
