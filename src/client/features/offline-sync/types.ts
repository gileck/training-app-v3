/**
 * Batch sync failure item
 */
export interface BatchSyncFailure {
    id: string;
    name: string;
    error: string;
    params?: Record<string, unknown>;
}

/**
 * Batch sync success item
 */
export interface BatchSyncSuccess {
    id: string;
    name: string;
}

export type AlertStatus = 'idle' | 'syncing' | 'success' | 'error' | 'partial';

