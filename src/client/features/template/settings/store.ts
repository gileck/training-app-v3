/**
 * Settings Store
 * 
 * Manages user preferences with localStorage persistence.
 */

import { createStore } from '@/client/stores';
import type { Settings } from './types';
import { defaultSettings } from './types';

interface SettingsState {
    settings: Settings;
    isDeviceOffline: boolean;

    updateSettings: (newSettings: Partial<Settings>) => void;
    setDeviceOffline: (offline: boolean) => void;
}

export const useSettingsStore = createStore<SettingsState>({
    key: 'settings-storage',
    label: 'Settings',
    creator: (set) => ({
        settings: defaultSettings,
        // Always start as online, let initializeOfflineListeners set the real value
        isDeviceOffline: false,

        updateSettings: (newSettings) => {
            set((state) => ({
                settings: { ...state.settings, ...newSettings },
            }));
        },

        setDeviceOffline: (offline) => {
            set({ isDeviceOffline: offline });
        },
    }),
    persistOptions: {
        partialize: (state) => ({ settings: state.settings }),
        // Merge persisted settings with defaults to handle new fields
        merge: (persistedState, currentState) => {
            const persisted = persistedState as { settings?: Partial<Settings> };
            const merged = {
                ...defaultSettings,
                ...persisted?.settings,
            };
            // Fall back to default if persisted aiModel is empty
            if (!merged.aiModel) {
                merged.aiModel = defaultSettings.aiModel;
            }
            return {
                ...currentState,
                settings: merged,
            };
        },
    },
});

/**
 * Initialize device offline listeners
 */
export function initializeOfflineListeners() {
    if (typeof window === 'undefined') return;

    const updateStatus = () => {
        useSettingsStore.getState().setDeviceOffline(!navigator.onLine);
    };

    // Set initial status
    updateStatus();

    // Listen for network changes
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
        window.removeEventListener('online', updateStatus);
        window.removeEventListener('offline', updateStatus);
    };
}

/**
 * Subscribe to effective offline changes
 */
export function subscribeToEffectiveOfflineChanges(
    callback: (effectiveOffline: boolean) => void
): () => void {
    const getEffectiveOffline = () => {
        const state = useSettingsStore.getState();
        return state.settings.offlineMode || state.isDeviceOffline;
    };

    const unsubSettings = useSettingsStore.subscribe(
        (state) => state.settings.offlineMode,
        () => callback(getEffectiveOffline())
    );

    const unsubDevice = useSettingsStore.subscribe(
        (state) => state.isDeviceOffline,
        () => callback(getEffectiveOffline())
    );

    return () => {
        unsubSettings();
        unsubDevice();
    };
}

/**
 * Hook to get effective offline status
 */
export function useEffectiveOffline(): boolean {
    const offlineMode = useSettingsStore((state) => state.settings.offlineMode);
    const isDeviceOffline = useSettingsStore((state) => state.isDeviceOffline);
    return offlineMode || isDeviceOffline;
}
