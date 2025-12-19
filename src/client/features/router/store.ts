/**
 * Route Store
 * 
 * Persists the last visited route for PWA instant boot.
 * When iOS kills the app and user reopens, they return to the same page.
 */

import { createStore } from '@/client/stores';
import { STORE_DEFAULTS, createTTLValidator } from '@/client/config';

// Use centralized TTL
const isRouteValid = createTTLValidator(STORE_DEFAULTS.TTL_ROUTE);

/**
 * Routes that should NOT be persisted/restored
 */
const EXCLUDED_ROUTES = ['/login', '/register', '/logout', '/forgot-password'];

interface RouteState {
    lastRoute: string | null;
    lastRouteTimestamp: number | null;

    setLastRoute: (route: string) => void;
    getValidLastRoute: () => string | null;
}

export const useRouteStore = createStore<RouteState>({
    key: 'route-storage',
    label: 'Router',
    creator: (set, get) => ({
        lastRoute: null,
        lastRouteTimestamp: null,

        setLastRoute: (route) => {
            if (EXCLUDED_ROUTES.some(excluded => route.startsWith(excluded))) {
                return;
            }
            set({
                lastRoute: route,
                lastRouteTimestamp: Date.now(),
            });
        },

        getValidLastRoute: () => {
            const state = get();
            if (!state.lastRoute || !state.lastRouteTimestamp) {
                return null;
            }
            if (!isRouteValid(state.lastRouteTimestamp)) {
                return null;
            }
            if (EXCLUDED_ROUTES.some(excluded => state.lastRoute?.startsWith(excluded))) {
                return null;
            }
            return state.lastRoute;
        },
    }),
    persistOptions: {
        partialize: (state) => ({
            lastRoute: state.lastRoute,
            lastRouteTimestamp: state.lastRouteTimestamp,
        }),
        onRehydrateStorage: () => (state) => {
            if (state && state.lastRouteTimestamp) {
                if (!isRouteValid(state.lastRouteTimestamp)) {
                    state.lastRoute = null;
                    state.lastRouteTimestamp = null;
                }
            }
        },
    },
});

export function useLastRoute(): string | null {
    return useRouteStore((state) => state.getValidLastRoute());
}
