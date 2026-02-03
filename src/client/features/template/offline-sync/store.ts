import { createStore } from '@/client/stores';
import type { AlertStatus, BatchSyncFailure, BatchSyncSuccess } from './types';

/**
 * Store for batch sync alert state
 */
interface BatchSyncAlertState {
    status: AlertStatus;
    totalItems: number;
    syncedItems: BatchSyncSuccess[];
    failures: BatchSyncFailure[];
    showSyncStart: (totalItems: number, items: Array<{ id: string; name: string }>) => void;
    showSuccess: (syncedItems: BatchSyncSuccess[]) => void;
    showFailures: (syncedItems: BatchSyncSuccess[], failures: BatchSyncFailure[]) => void;
    dismiss: () => void;
}

export const useBatchSyncAlertStore = createStore<BatchSyncAlertState>({
    key: 'batch-sync-alert',
    label: 'Batch Sync Alert',
    inMemoryOnly: true,
    creator: (set) => ({
        status: 'idle',
        totalItems: 0,
        syncedItems: [],
        failures: [],
        showSyncStart: (totalItems, items) => set({
            status: 'syncing',
            totalItems,
            syncedItems: items.map(i => ({ id: i.id, name: i.name })),
            failures: [],
        }),
        showSuccess: (syncedItems) => set({
            status: 'success',
            syncedItems,
            failures: [],
        }),
        showFailures: (syncedItems, failures) => set({
            status: failures.length > 0 && syncedItems.length > 0 ? 'partial' : 'error',
            syncedItems,
            failures,
        }),
        dismiss: () => set({ status: 'idle', totalItems: 0, syncedItems: [], failures: [] }),
    }),
});
