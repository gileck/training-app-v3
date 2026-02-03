/**
 * Bug Report Store
 * 
 * Manages the bug report dialog open state.
 */

import { createStore } from '@/client/stores';

interface BugReportState {
    isOpen: boolean;
    
    // Actions
    openDialog: () => void;
    closeDialog: () => void;
}

export const useBugReportStore = createStore<BugReportState>({
    key: 'bug-report',
    label: 'Bug Report',
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
export function useBugReportDialogOpen(): boolean {
    return useBugReportStore((state) => state.isOpen);
}

export function useOpenBugReportDialog() {
    return useBugReportStore((state) => state.openDialog);
}

export function useCloseBugReportDialog() {
    return useBugReportStore((state) => state.closeDialog);
}
