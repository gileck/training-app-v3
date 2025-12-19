/**
 * Settings Feature
 * 
 * User preferences with localStorage persistence.
 */

export {
    useSettingsStore,
    initializeOfflineListeners,
    subscribeToEffectiveOfflineChanges,
    useEffectiveOffline,
} from './store';

export type { Settings } from './types';
export { defaultSettings } from './types';

