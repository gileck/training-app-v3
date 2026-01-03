/**
 * Zustand Store Registry
 * 
 * Central registry for all Zustand stores with cache management utilities.
 */

import type { StoreInfo, CacheSize, CacheSizeInfo } from './types';
import { formatBytes } from '@/client/lib/utils';
import { useEffect, useState } from 'react';

// ============================================================================
// Registry Storage
// ============================================================================

/**
 * Internal registry of all stores
 */
const storeRegistry = new Map<string, StoreInfo>();
const storeInstances = new Map<string, unknown>();

// ============================================================================
// Registration (internal use by createStore)
// ============================================================================

/**
 * Register a store in the registry (called by createStore)
 * @internal
 */
export function registerStore(info: StoreInfo, storeInstance?: unknown): void {
    if (storeRegistry.has(info.key)) {
        console.warn(`[Store Registry] Store "${info.key}" is already registered. Overwriting.`);
    }
    storeRegistry.set(info.key, info);
    if (storeInstance) {
        storeInstances.set(info.key, storeInstance);
    }
}

// ============================================================================
// Query Utilities
// ============================================================================

/**
 * Get all registered stores
 */
export function getAllStores(): StoreInfo[] {
    return Array.from(storeRegistry.values());
}

/**
 * Get only persisted stores (those using localStorage)
 */
export function getPersistedStores(): StoreInfo[] {
    return getAllStores().filter((store) => store.isPersisted);
}

function getPersistedStoreInstances(): unknown[] {
    return getPersistedStores()
        .map((s) => storeInstances.get(s.key))
        .filter((s): s is unknown => s != null);
}

function isStoreHydrated(store: unknown): boolean {
    // Zustand persist middleware adds `persist.hasHydrated()` at runtime.
    const anyStore = store as { persist?: { hasHydrated?: () => boolean } };
    return anyStore.persist?.hasHydrated?.() === true;
}

function areAllPersistedStoresHydrated(): boolean {
    if (typeof window === 'undefined') return true;
    const stores = getPersistedStoreInstances();
    // If we don't have instances yet, treat as hydrated (no gate).
    if (stores.length === 0) return true;
    return stores.every(isStoreHydrated);
}

/**
 * React hook: true once all persisted Zustand stores have finished rehydrating
 * AND React has propagated the values to all selectors.
 *
 * This waits one frame after hasHydrated() returns true to ensure React hooks
 * reading from stores will receive the hydrated values, not defaults.
 */
export function useAllPersistedStoresHydrated(): boolean {
    // Track two phases: stores hydrated, then React propagated
    const [storesHydrated, setStoresHydrated] = useState<boolean>(() => areAllPersistedStoresHydrated());
    const [reactReady, setReactReady] = useState<boolean>(false);

    // Phase 1: Wait for all stores to hydrate
    useEffect(() => {
        if (typeof window === 'undefined') return;

        setStoresHydrated(areAllPersistedStoresHydrated());

        const instances = getPersistedStoreInstances();
        const unsubs: Array<() => void> = [];

        for (const store of instances) {
            const anyStore = store as { persist?: { onFinishHydration?: (cb: () => void) => () => void } };
            const unsub = anyStore.persist?.onFinishHydration?.(() => {
                setStoresHydrated(areAllPersistedStoresHydrated());
            });
            if (unsub) unsubs.push(unsub);
        }

        return () => {
            unsubs.forEach((u) => {
                try {
                    u();
                } catch {
                    // ignore
                }
            });
        };
    }, []);

    // Phase 2: Wait one frame for React to propagate values to selectors
    useEffect(() => {
        if (storesHydrated && !reactReady) {
            const raf = requestAnimationFrame(() => {
                setReactReady(true);
            });
            return () => cancelAnimationFrame(raf);
        }
    }, [storesHydrated, reactReady]);

    return storesHydrated && reactReady;
}

/**
 * Get only in-memory stores
 */
export function getInMemoryStores(): StoreInfo[] {
    return getAllStores().filter((store) => !store.isPersisted);
}

// ============================================================================
// Cache Size Utilities
// ============================================================================

/**
 * Get the size of a single localStorage item
 */
function getItemSize(key: string): number {
    if (typeof localStorage === 'undefined') return 0;
    try {
        const data = localStorage.getItem(key);
        return data ? new Blob([data]).size : 0;
    } catch {
        return 0;
    }
}

/**
 * Get total cache size of all persisted stores
 */
export function getTotalCacheSize(): CacheSize {
    const stores = getPersistedStores();
    const bytes = stores.reduce((total, store) => total + getItemSize(store.key), 0);
    return { bytes, formatted: formatBytes(bytes) };
}

/**
 * Get cache size breakdown per store
 */
export function getCacheSizeBreakdown(): CacheSizeInfo[] {
    const stores = getPersistedStores();
    return stores
        .map((store) => {
            const bytes = getItemSize(store.key);
            return {
                key: store.key,
                label: store.label,
                bytes,
                formatted: formatBytes(bytes),
            };
        })
        .sort((a, b) => b.bytes - a.bytes); // Sort by size descending
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear all persisted store data from localStorage
 */
export function clearAllPersistedStores(): void {
    if (typeof localStorage === 'undefined') return;

    const stores = getPersistedStores();
    stores.forEach((store) => {
        try {
            localStorage.removeItem(store.key);
        } catch (error) {
            console.error(`[Store Registry] Failed to clear store "${store.key}":`, error);
        }
    });
}

/**
 * Clear a specific store's persisted data
 */
export function clearPersistedStore(key: string): boolean {
    if (typeof localStorage === 'undefined') return false;

    const store = storeRegistry.get(key);
    if (!store) {
        console.warn(`[Store Registry] Store "${key}" not found in registry`);
        return false;
    }
    if (!store.isPersisted) {
        console.warn(`[Store Registry] Store "${key}" is not persisted`);
        return false;
    }

    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`[Store Registry] Failed to clear store "${key}":`, error);
        return false;
    }
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Print all stores to console for debugging
 */
export function printAllStores(): void {
    console.group('[Store Registry] All Registered Stores');

    const stores = getAllStores();
    console.log(`Total stores: ${stores.length}`);
    console.log(`Persisted: ${getPersistedStores().length}`);
    console.log(`In-memory: ${getInMemoryStores().length}`);
    console.log('---');

    // Print persisted stores with their data
    const persistedStores = getPersistedStores();
    if (persistedStores.length > 0) {
        console.group('📦 Persisted Stores');
        persistedStores.forEach((store) => {
            try {
                const data = localStorage.getItem(store.key);
                if (data) {
                    const parsed = JSON.parse(data);
                    const size = formatBytes(new Blob([data]).size);
                    console.group(`${store.label} (${store.key})`);
                    console.log('Size:', size);
                    console.log('Data:', parsed);
                    console.groupEnd();
                } else {
                    console.log(`${store.label} (${store.key}): (empty)`);
                }
            } catch (error) {
                console.error(`${store.label} (${store.key}): Failed to parse`, error);
            }
        });
        console.groupEnd();
    }

    // Print in-memory stores
    const inMemoryStores = getInMemoryStores();
    if (inMemoryStores.length > 0) {
        console.group('💭 In-Memory Stores');
        inMemoryStores.forEach((store) => {
            console.log(`${store.label} (${store.key})`);
        });
        console.groupEnd();
    }

    // Print total size
    const totalSize = getTotalCacheSize();
    console.log('---');
    console.log(`Total persisted size: ${totalSize.formatted}`);

    console.groupEnd();
}

