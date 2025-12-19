/**
 * Zustand Store Factory & Registry
 * 
 * This module provides a unified factory for creating Zustand stores
 * with automatic registration, persistence defaults, and cache management.
 * 
 * @example
 * ```typescript
 * import { createStore } from '@/client/stores';
 * 
 * // PERSISTED store (default) - persistOptions REQUIRED
 * const useMyStore = createStore<MyState>({
 *   key: 'my-storage',
 *   label: 'My Store',
 *   creator: (set) => ({ ... }),
 *   persistOptions: { partialize: (state) => ({ ... }) },
 * });
 * 
 * // IN-MEMORY store (explicit opt-out) - inMemoryOnly REQUIRED
 * const useSessionStore = createStore<SessionState>({
 *   key: 'session',
 *   label: 'Session',
 *   inMemoryOnly: true,
 *   creator: (set) => ({ ... }),
 * });
 * ```
 * 
 * See docs/zustand-stores.md for comprehensive guidelines.
 */

// Factory
export { createStore } from './createStore';

// Registry utilities
export {
    getAllStores,
    getPersistedStores,
    getInMemoryStores,
    useAllPersistedStoresHydrated,
    getTotalCacheSize,
    getCacheSizeBreakdown,
    clearAllPersistedStores,
    clearPersistedStore,
    printAllStores,
} from './registry';

// Types
export type {
    StoreInfo,
    CacheSize,
    CacheSizeInfo,
    PersistedStoreConfig,
    InMemoryStoreConfig,
    StoreConfig,
} from './types';

// ============================================================================
// NOTE: Feature re-exports removed to prevent circular dependencies
// ============================================================================

/**
 * Import directly from @/client/features instead:
 * - @/client/features/auth
 * - @/client/features/settings
 * - @/client/features/router
 */
