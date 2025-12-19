/**
 * Settings Feature Types
 */

export interface Settings {
    aiModel: string;
    theme: 'light' | 'dark';
    offlineMode: boolean;
    staleWhileRevalidate: boolean;
}

export const defaultSettings: Settings = {
    aiModel: '',
    theme: 'light',
    offlineMode: false,
    staleWhileRevalidate: false,
};

