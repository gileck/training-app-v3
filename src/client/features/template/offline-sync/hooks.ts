import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    flushOfflineQueue,
    shouldFlushNow,
    onOfflineQueueSync,
    onOfflineQueueSyncStart
} from '@/client/utils/offlinePostQueue';
import { useSettingsStore, subscribeToEffectiveOfflineChanges } from '@/client/features';
import { useBatchSyncAlertStore } from './store';

/**
 * Hook to initialize offline sync system.
 * Handles:
 * - Registering sync start/complete callbacks
 * - Showing sync alerts
 * - Invalidating React Query caches after sync
 * - Flushing queue when coming back online
 * 
 * Should be called once at app initialization (e.g., in _app.tsx).
 */
export function useOfflineSyncInitializer(): void {
    const settings = useSettingsStore((state) => state.settings);
    const queryClient = useQueryClient();

    // Get the batch sync alert store actions
    const showSyncStart = useBatchSyncAlertStore((state) => state.showSyncStart);
    const showSuccess = useBatchSyncAlertStore((state) => state.showSuccess);
    const showFailures = useBatchSyncAlertStore((state) => state.showFailures);

    // Register callback to show sync start alert
    useEffect(() => {
        const unsubscribe = onOfflineQueueSyncStart(({ totalItems, items }) => {
            showSyncStart(totalItems, items.map(i => ({ id: i.id, name: i.name })));
        });
        return unsubscribe;
    }, [showSyncStart]);

    // Register callback to invalidate caches when offline items sync and show results
    useEffect(() => {
        const unsubscribe = onOfflineQueueSync(({ syncedItems, failedItems }) => {
            // Extract unique entity types from synced items and invalidate their queries
            const entityTypes = new Set<string>();
            for (const item of syncedItems) {
                // Extract entity from API name (e.g., "todos/update" -> "todos")
                const entity = item.name.split('/')[0];
                if (entity) entityTypes.add(entity);
            }

            // Invalidate queries for each synced entity type
            for (const entity of entityTypes) {
                queryClient.invalidateQueries({ queryKey: [entity] });
            }

            // Show success or failure alert based on results
            const syncedForAlert = syncedItems.map((item) => ({
                id: item.id,
                name: item.name,
            }));
            const failuresForAlert = failedItems.map(({ item, error }) => ({
                id: item.id,
                name: item.name,
                error,
                params: item.params as Record<string, unknown> | undefined,
            }));

            if (failedItems.length > 0) {
                // Show failures (will show partial success if some succeeded)
                showFailures(syncedForAlert, failuresForAlert);
            } else if (syncedItems.length > 0) {
                // All succeeded
                showSuccess(syncedForAlert);
            }
        });
        return unsubscribe;
    }, [queryClient, showFailures, showSuccess]);

    // Subscribe to effective offline changes for queue flushing
    useEffect(() => {
        const unsubscribe = subscribeToEffectiveOfflineChanges((effectiveOffline) => {
            if (!effectiveOffline && shouldFlushNow(settings)) {
                void flushOfflineQueue(() => useSettingsStore.getState().settings);
            }
        });
        return unsubscribe;
    }, [settings]);

    // Also try to flush on settings change
    useEffect(() => {
        if (shouldFlushNow(settings)) {
            void flushOfflineQueue(() => settings);
        }
    }, [settings]);
}

