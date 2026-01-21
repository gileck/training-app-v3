import "@/client/styles/globals.css";
import "@/client/styles/project.css";  // Project-specific styles (ignored by template-sync)
import type { AppProps } from "next/app";
import Head from 'next/head';
import { AppThemeProvider } from "@/client/components/ThemeProvider";
import dynamic from 'next/dynamic';
import { routes } from '@/client/routes';
import { Layout } from '@/client/components/Layout';
import { useEffect, useRef, type ReactNode } from 'react';
import { QueryProvider } from '@/client/query';
import {
  AuthWrapper,
  useSettingsStore,
  initializeOfflineListeners,
  BatchSyncAlert,
  useOfflineSyncInitializer
} from '@/client/features';
import { initializeApiClient } from '@/client/utils/apiClient';
import { useAllPersistedStoresHydrated } from '@/client/stores';
import { markEvent, BOOT_PHASES } from '@/client/features/boot-performance';
// Import preflight early to start /me call ASAP (side effect import)
import '@/client/features/auth/preflight';

const RouterProvider = dynamic(() => import('@/client/router/index').then(module => module.RouterProvider), { ssr: false });

// Mark app mount as early as possible
markEvent(BOOT_PHASES.APP_MOUNT);

export default function App({ }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </Head>
      <QueryProvider>
        <AppInitializer />
        <BootGate>
          <AppThemeProvider>
            <RouterProvider routes={routes}>
              {RouteComponent => (
                <AuthWrapper>
                  <Layout><RouteComponent /></Layout>
                </AuthWrapper>
              )}
            </RouterProvider>
            <BatchSyncAlert />
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
