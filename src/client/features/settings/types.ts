/**
 * Settings Feature Types
 */

export interface Settings {
    aiModel: string;
    theme: 'light' | 'dark';
    offlineMode: boolean;
    staleWhileRevalidate: boolean;
    /** How long data is considered "fresh" in seconds (won't refetch). Default: 30 */
    cacheStaleTimeSeconds: number;
    /** How long to keep data in memory after unmount in minutes. Default: 30 */
    cacheGcTimeMinutes: number;
    /** How long to persist cache to localStorage in days. Default: 7 */
    cachePersistDays: number;
}

export const defaultSettings: Settings = {
    aiModel: '',
    theme: 'light',
    offlineMode: false,
    staleWhileRevalidate: true,
    cacheStaleTimeSeconds: 30,
    cacheGcTimeMinutes: 30,
    cachePersistDays: 7,
};

