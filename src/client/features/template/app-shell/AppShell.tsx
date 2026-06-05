/**
 * AppShell — template-owned application root.
 *
 * Owns the full provider / bridge / boot tree (Query, Theme, Router, Auth,
 * Layout, hydration gating, offline + API-client init, and app-root bridges).
 *
 * A child project's `src/pages/_app.tsx` is a thin shim that renders <AppShell/>
 * (and imports global CSS, which Next only allows from _app). Because this file
 * and everything it mounts are template-owned and synced, template features that
 * need app-root wiring — e.g. push deep-link navigation via <TemplateAppBridges>
 * — work end-to-end in every child with no per-project _app.tsx changes.
 *
 * Project extension seam: pass `wrapProviders` from your _app.tsx to inject
 * project-wide context providers around all routes. They render inside Query +
 * Theme context (and after store hydration), wrapping the router subtree:
 *
 *     <AppShell wrapProviders={(children) => <MyProvider>{children}</MyProvider>} />
 *
 * The seam is a prop (not an import) on purpose: AppShell never depends on a
 * project symbol, so it compiles cleanly in every synced child.
 */
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useEffect, useRef, type ReactNode, type ReactElement } from 'react';

import { routes } from '@/client/routes';
import { QueryProvider } from '@/client/query';
import { AppThemeProvider } from '@/client/components/template/ThemeProvider';
import { Layout } from '@/client/components/template/Layout';
import { useAllPersistedStoresHydrated } from '@/client/stores';
import { initializeApiClient } from '@/client/utils/apiClient';

// Import from specific feature modules (not the @/client/features barrel) so we
// don't create a barrel -> app-shell -> routes -> route-components -> barrel cycle.
import { AuthWrapper, RoutePasskeyGuard } from '../auth';
import { useSettingsStore, initializeOfflineListeners } from '../settings';
import { BatchSyncAlert, useOfflineSyncInitializer } from '../offline-sync';
import { markEvent, BOOT_PHASES } from '../boot-performance';
import { TemplateAppBridges } from './TemplateAppBridges';

// Side effect: start the /me preflight call as early as possible.
import '../auth/preflight';

const RouterProvider = dynamic(
    () => import('../router/Router').then((module) => module.RouterProvider),
    { ssr: false }
);

// Mark app mount as early as possible (runs at module load time).
markEvent(BOOT_PHASES.APP_MOUNT);

type ProvidersWrapper = (children: ReactNode) => ReactNode;

const identityWrap: ProvidersWrapper = (children) => children;

interface AppShellProps {
    /**
     * Optional project hook to wrap all routes with custom context providers.
     * Receives the router subtree and must return it wrapped. Defaults to a
     * passthrough.
     */
    wrapProviders?: ProvidersWrapper;
}

export function AppShell({ wrapProviders = identityWrap }: AppShellProps): ReactElement {
    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
            </Head>
            <QueryProvider>
                <AppInitializer />
                <BootGate>
                    <AppThemeProvider>
                        {wrapProviders(
                            <>
                                <RouterProvider routes={routes}>
                                    {RouteComponent => (
                                        <AuthWrapper>
                                            <TemplateAppBridges />
                                            <Layout>
                                                <RoutePasskeyGuard>
                                                    <RouteComponent />
                                                </RoutePasskeyGuard>
                                            </Layout>
                                        </AuthWrapper>
                                    )}
                                </RouterProvider>
                                <BatchSyncAlert />
                            </>
                        )}
                    </AppThemeProvider>
                </BootGate>
            </QueryProvider>
        </>
    );
}

function BootGate({ children }: { children: ReactNode }) {
    const isHydrated = useAllPersistedStoresHydrated();
    const hasLoggedPassed = useRef(false);
    const hasLoggedWaiting = useRef(false);

    // Log waiting state (only once)
    if (!isHydrated && !hasLoggedWaiting.current) {
        hasLoggedWaiting.current = true;
        markEvent(BOOT_PHASES.BOOT_GATE_WAITING);
    }

    if (isHydrated) {
        // Log synchronously BEFORE rendering children so timeline order is correct
        // (useEffect would run AFTER child effects, causing confusing order)
        if (!hasLoggedPassed.current) {
            hasLoggedPassed.current = true;
            markEvent(BOOT_PHASES.BOOT_GATE_PASSED);
        }
        return <>{children}</>;
    }

    // Intentionally render nothing to avoid a "flash" of a loader for very fast localStorage rehydrate.
    return null;
}

/**
 * App initialization component
 * Handles:
 * - Offline listener initialization
 * - API client initialization with settings
 * - Offline sync queue management (via useOfflineSyncInitializer)
 */
function AppInitializer() {
    // Initialize offline listeners on mount
    useEffect(() => {
        const cleanup = initializeOfflineListeners();
        return cleanup;
    }, []);

    // Initialize API client with settings getter
    useEffect(() => {
        initializeApiClient(() => useSettingsStore.getState().settings);
    }, []);

    // Initialize offline sync system (queue flushing, alerts, cache invalidation)
    useOfflineSyncInitializer();

    return null;
}
