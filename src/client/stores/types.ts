/**
 * Zustand Store Factory Types
 * 
 * Type definitions for the centralized store factory and registry.
 */

import type { StateCreator } from 'zustand';
import type { PersistOptions } from 'zustand/middleware';

// ============================================================================
// Store Registry Types
// ============================================================================

/**
 * Information about a registered store
 */
export interface StoreInfo {
    /** Unique storage key (used for localStorage) */
    key: string;
    /** Human-readable label for display */
    label: string;
    /** Whether the store persists to localStorage */
    isPersisted: boolean;
}

/**
 * Cache size information
 */
export interface CacheSize {
    bytes: number;
    formatted: string;
}

/**
 * Cache size breakdown per store
 */
export interface CacheSizeInfo extends CacheSize {
    key: string;
    label: string;
}

// ============================================================================
// Store Config Types (TypeScript Overloads)
// ============================================================================

/**
 * Base config shared by all store types
 */
interface BaseStoreConfig<T> {
    /** Unique storage key */
    key: string;
    /** Human-readable label for display in Settings/debug */
    label: string;
    /** Zustand state creator function */
    creator: StateCreator<T, [], []>;
}

/**
 * Config for PERSISTED stores (default behavior)
 * - persistOptions is REQUIRED
 * - inMemoryOnly must NOT be present
 */
export interface PersistedStoreConfig<T> extends BaseStoreConfig<T> {
    /** Persistence options (partialize, onRehydrateStorage, etc.) */
    persistOptions: Omit<PersistOptions<T, Partial<T>>, 'name'>;
    /** Must not be set for persisted stores */
    inMemoryOnly?: never;
    /** Enable subscribeWithSelector middleware (default: true for persisted stores) */
    withSelector?: boolean;
}

/**
 * Config for IN-MEMORY stores (explicit opt-out)
 * - inMemoryOnly must be TRUE
 * - persistOptions must NOT be present
 */
export interface InMemoryStoreConfig<T> extends BaseStoreConfig<T> {
    /** Mark as in-memory only - no localStorage persistence */
    inMemoryOnly: true;
    /** Must not be set for in-memory stores */
    persistOptions?: never;
    /** Enable subscribeWithSelector middleware (default: false for in-memory stores) */
    withSelector?: boolean;
}

/**
 * Union type for store config
 */
export type StoreConfig<T> = PersistedStoreConfig<T> | InMemoryStoreConfig<T>;
