/**
 * Zustand Store Factory
 * 
 * Unified factory for creating Zustand stores with automatic registration
 * and enforced persistence patterns.
 * 
 * @example
 * // PERSISTED store (default) - persistOptions REQUIRED
 * const useSettingsStore = createStore<SettingsState>({
 *   key: 'settings-storage',
 *   label: 'Settings',
 *   creator: (set) => ({ settings: defaultSettings, ... }),
 *   persistOptions: { partialize: (state) => ({ settings: state.settings }) },
 * });
 * 
 * @example
 * // IN-MEMORY store (explicit opt-out) - inMemoryOnly REQUIRED
 * const useSessionLogsStore = createStore<SessionLogsState>({
 *   key: 'session-logs',
 *   label: 'Session Logs',
 *   inMemoryOnly: true,
 *   creator: (set, get) => ({ logs: [], ... }),
 * });
 */

import { create, type StoreApi } from 'zustand';
import { persist, subscribeWithSelector, type PersistOptions } from 'zustand/middleware';
import type { PersistedStoreConfig, InMemoryStoreConfig } from './types';
import { registerStore } from './registry';

// ============================================================================
// Store Return Types
// ============================================================================

/**
 * Subscribe with selector function signature
 */
type SubscribeWithSelector<T> = {
    subscribe: {
        (listener: (state: T, prevState: T) => void): () => void;
        <U>(
            selector: (state: T) => U,
            listener: (selectedState: U, previousSelectedState: U) => void,
            options?: {
                equalityFn?: (a: U, b: U) => boolean;
                fireImmediately?: boolean;
            }
        ): () => void;
    };
};

/**
 * The base store hook type (callable with optional selector)
 */
type BaseStoreHook<T> = {
    (): T;
    <U>(selector: (state: T) => U): U;
    getState: () => T;
    setState: StoreApi<T>['setState'];
    getInitialState: () => T;
};

/**
 * Store hook with subscribeWithSelector middleware
 */
export type StoreHookWithSelector<T> = BaseStoreHook<T> & SubscribeWithSelector<T>;

/**
 * Store hook without subscribeWithSelector middleware (basic subscribe)
 */
export type StoreHook<T> = BaseStoreHook<T> & {
    subscribe: (listener: (state: T, prevState: T) => void) => () => void;
};

// ============================================================================
// Factory Overloads
// ============================================================================

/**
 * Create a PERSISTED store (default behavior)
 * 
 * - Automatically persists to localStorage
 * - Applies subscribeWithSelector middleware by default
 * - Registers to central store registry
 */
export function createStore<T>(config: PersistedStoreConfig<T>): StoreHookWithSelector<T>;

/**
 * Create an IN-MEMORY store (explicit opt-out)
 * 
 * - No localStorage persistence
 * - Registers to central store registry
 */
export function createStore<T>(config: InMemoryStoreConfig<T>): StoreHook<T>;

/**
 * Implementation
 */
export function createStore<T>(
    config: PersistedStoreConfig<T> | InMemoryStoreConfig<T>
): StoreHookWithSelector<T> | StoreHook<T> {
    const { key, label, creator } = config;
    
    // Register store metadata in the registry (store instance registered after creation)
    const isPersisted = !('inMemoryOnly' in config && config.inMemoryOnly);
    
    // In-memory store (no persistence)
    if ('inMemoryOnly' in config && config.inMemoryOnly) {
        // Apply subscribeWithSelector if explicitly requested
        if (config.withSelector) {
            const store = create<T>()(subscribeWithSelector(creator)) as unknown as StoreHookWithSelector<T>;
            registerStore({ key, label, isPersisted }, store);
            return store;
        }
        const store = create<T>()(creator) as unknown as StoreHook<T>;
        registerStore({ key, label, isPersisted }, store);
        return store;
    }
    
    // Persisted store (default)
    const persistedConfig = config as PersistedStoreConfig<T>;
    const { persistOptions, withSelector = true } = persistedConfig;
    
    // Build persist options with the key as name
    const fullPersistOptions: PersistOptions<T, Partial<T>> = {
        ...persistOptions,
        name: key,
    };
    
    // Apply middlewares: subscribeWithSelector wraps persist
    if (withSelector) {
        const store = create<T>()(
            subscribeWithSelector(
                persist(creator, fullPersistOptions)
            )
        ) as unknown as StoreHookWithSelector<T>;
        registerStore({ key, label, isPersisted }, store);
        return store;
    }
    
    // Just persist without subscribeWithSelector
    const store = create<T>()(persist(creator, fullPersistOptions)) as unknown as StoreHook<T>;
    registerStore({ key, label, isPersisted }, store);
    return store;
}
