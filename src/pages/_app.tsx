import "@/client/styles/globals.css";
import "@/client/styles/project.css";  // Project-specific styles (ignored by template-sync)
import type { AppProps } from "next/app";
import { AppThemeProvider } from "@/client/components/ThemeProvider";
import dynamic from 'next/dynamic';
import { routes } from '@/client/routes';
import { Layout } from '@/client/components/Layout';
import { useEffect, type ReactNode } from 'react';
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

const RouterProvider = dynamic(() => import('@/client/router/index').then(module => module.RouterProvider), { ssr: false });

export default function App({ }: AppProps) {
  return (
    <QueryProvider>
      <AppInitializer />
      <BootGate>
        <AppThemeProvider>
          <AuthWrapper>
            <RouterProvider routes={routes}>
              {RouteComponent => <Layout><RouteComponent /></Layout>}
            </RouterProvider>
          </AuthWrapper>
          <BatchSyncAlert />
        </AppThemeProvider>
      </BootGate>
    </QueryProvider>
  );
}

function BootGate({ children }: { children: ReactNode }) {
  const isHydrated = useAllPersistedStoresHydrated();
  if (isHydrated) return <>{children}</>;

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
