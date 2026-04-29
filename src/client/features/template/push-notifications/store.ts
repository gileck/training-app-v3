import { createStore } from '@/client/stores';

interface PushNotificationsState {
    /** Known server-side subscription status for the current user. */
    subscribed: boolean;
    /** Endpoint currently persisted on server for this device (if any). */
    endpoint: string | null;
    setSubscribed: (subscribed: boolean, endpoint?: string | null) => void;
    reset: () => void;
}

export const usePushNotificationsStore = createStore<PushNotificationsState>({
    key: 'push-notifications',
    label: 'Push Notifications',
    creator: (set) => ({
        subscribed: false,
        endpoint: null,
        setSubscribed: (subscribed, endpoint) =>
            set({
                subscribed,
                endpoint: endpoint ?? (subscribed ? null : null),
            }),
        reset: () => set({ subscribed: false, endpoint: null }),
    }),
    persistOptions: {
        partialize: (state) => ({
            subscribed: state.subscribed,
            endpoint: state.endpoint,
        }),
    },
});
