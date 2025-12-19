import type { Settings } from "@/client/features/settings";
import type { BatchSyncResponse } from "@/apis/batch-updates/types";
import { logger } from "@/client/features/session-logs";

type PrimitiveParam = string | number | boolean | undefined | null;
export interface OfflinePostQueueItem<Params = Record<string, PrimitiveParam>> {
    id: string;
    name: string;
    params: Params | undefined;
    options?: unknown | undefined;
    enqueuedAt: number;
    retryCount?: number;
}

const MAX_RETRIES = 3;

const OFFLINE_POST_QUEUE_STORAGE_KEY = 'apiClient_offline_post_queue_v1';
let queueFlushInProgress = false;

/**
 * Sync result with both successes and failures
 */
export interface SyncResult {
    syncedItems: OfflinePostQueueItem[];
    failedItems: Array<{
        item: OfflinePostQueueItem;
        error: string;
    }>;
}

/**
 * Sync start event payload
 */
export interface SyncStartEvent {
    totalItems: number;
    items: OfflinePostQueueItem[];
}

// Callback to notify when sync completes (for cache invalidation and error display)
let onSyncCallback: ((result: SyncResult) => void) | null = null;
// Callback to notify when sync starts
let onSyncStartCallback: ((event: SyncStartEvent) => void) | null = null;

/**
 * Register a callback to be notified when offline sync completes.
 * This allows React Query caches to be invalidated and errors to be displayed.
 */
export function onOfflineQueueSync(callback: (result: SyncResult) => void): () => void {
    onSyncCallback = callback;
    return () => { onSyncCallback = null; };
}

/**
 * Register a callback to be notified when offline sync starts.
 * This allows UI to show "syncing X items" indicator.
 */
export function onOfflineQueueSyncStart(callback: (event: SyncStartEvent) => void): () => void {
    onSyncStartCallback = callback;
    return () => { onSyncStartCallback = null; };
}

export function loadOfflineQueue(): OfflinePostQueueItem[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(OFFLINE_POST_QUEUE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function saveOfflineQueue(queue: OfflinePostQueueItem[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(OFFLINE_POST_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch {
        // ignore write failures
    }
}

export function enqueueOfflinePost<Params = Record<string, PrimitiveParam>>(item: OfflinePostQueueItem<Params>): void {
    const q = loadOfflineQueue();
    q.push(item as OfflinePostQueueItem);
    saveOfflineQueue(q);
}

export function generateQueueId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function shouldFlushNow(settings: Settings | null | undefined): boolean {
    const deviceOnline = typeof navigator === 'undefined' ? false : navigator.onLine;
    const offlineMode = settings?.offlineMode === true;
    return deviceOnline && !offlineMode;
}

/**
 * Flush the offline queue by sending all queued operations in a single batch request.
 * This is more efficient than making N separate API calls.
 */
export async function flushOfflineQueue(getSettings: () => Settings | null | undefined): Promise<void> {
    if (queueFlushInProgress) return;
    const settings = getSettings();
    if (!shouldFlushNow(settings)) return;

    const q = loadOfflineQueue();
    if (q.length === 0) return;

    queueFlushInProgress = true;
    const syncedItems: OfflinePostQueueItem[] = [];
    const failedItems: Array<{ item: OfflinePostQueueItem; error: string }> = [];

    // Notify listeners that sync is starting
    if (onSyncStartCallback) {
        onSyncStartCallback({ totalItems: q.length, items: q });
    }

    try {
        // Build batch operations array
        const operations = q.map(item => ({
            id: item.id,
            name: item.name,
            params: item.params,
        }));

        // Send all operations in a single batch request
        const response = await fetch('/api/process/batch-updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operations }),
        });

        if (response.status !== 200) {
            console.error('Batch sync failed with status:', response.status);
            return;
        }

        const result: BatchSyncResponse = await response.json();

        // If the server reports a top-level error, do NOT treat this as per-item failures.
        // Keep the queue intact so we can retry later (matches the old "non-200 => return" behavior).
        if (result.error) {
            logger.error('offline-sync', `Batch sync failed: ${result.error}`);
            return;
        }

        // Build maps for success/failure lookup
        const successIds = new Set<string>();
        const errorMap = new Map<string, string>();
        for (const opResult of result.results) {
            if (opResult.success) {
                successIds.add(opResult.id);
            } else {
                errorMap.set(opResult.id, opResult.error || 'Unknown error');
                console.warn(`Batch operation ${opResult.id} failed:`, opResult.error);
            }
        }

        // Track synced items, failed items, and filter queue
        const remainingQueue: OfflinePostQueueItem[] = [];
        for (const item of q) {
            if (successIds.has(item.id)) {
                syncedItems.push(item);
            } else {
                const error = errorMap.get(item.id) || 'Unknown error';
                // Increment retry count and keep if under max
                const retries = (item.retryCount || 0) + 1;
                if (retries < MAX_RETRIES) {
                    remainingQueue.push({ ...item, retryCount: retries });
                } else {
                    // Track as failed (dropped after max retries)
                    failedItems.push({ item, error });
                    console.error(`Dropping offline item ${item.id} (${item.name}) after ${MAX_RETRIES} failed retries`);
                }
            }
        }

        // Save remaining items back to queue
        saveOfflineQueue(remainingQueue);

        logger.info('offline-sync', `Batch sync completed: ${result.successCount} succeeded, ${result.failureCount} failed`);
    } catch (error) {
        console.error('Batch sync error:', error);
    } finally {
        queueFlushInProgress = false;

        // Notify listeners so they can invalidate caches and show errors
        if (onSyncCallback && (syncedItems.length > 0 || failedItems.length > 0)) {
            onSyncCallback({ syncedItems, failedItems });
        }
    }
}

// Online listener handled externally via Settings subscription


