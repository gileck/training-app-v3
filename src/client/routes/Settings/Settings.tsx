import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/client/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select';
import { Switch } from '@/client/components/ui/switch';
import { Card } from '@/client/components/ui/card';
import { Separator } from '@/client/components/ui/separator';
import { Alert } from '@/client/components/ui/alert';
import { LinearProgress } from '@/client/components/ui/linear-progress';
import { getAllModels, type AIModelDefinition } from '@/common/ai/models';
import { useSettingsStore } from '@/client/features/settings';
import { clearCache as clearCacheApi } from '@/apis/settings/clearCache/client';
import {
  getTotalCacheSize,
  getCacheSizeBreakdown,
  clearAllPersistedStores,
  printAllStores,
  type CacheSizeInfo,
} from '@/client/stores';
import { formatBytes } from '@/client/lib/utils';

// React Query cache key (not managed by store registry)
const REACT_QUERY_CACHE_KEY = 'react-query-cache-v2';

// localStorage limit is typically ~5MB
const LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024;

interface CacheSizeState {
  total: { bytes: number; formatted: string };
  breakdown: Array<{ name: string; key: string; bytes: number; formatted: string }>;
}

/**
 * Get combined cache size including both store registry and React Query
 */
function getCombinedCacheSize(): CacheSizeState {
  // Get store registry sizes
  const storeTotal = getTotalCacheSize();
  const storeBreakdown = getCacheSizeBreakdown();
  
  // Get React Query cache size
  let reactQueryBytes = 0;
  try {
    const rqData = localStorage.getItem(REACT_QUERY_CACHE_KEY);
    reactQueryBytes = rqData ? new Blob([rqData]).size : 0;
  } catch {
    reactQueryBytes = 0;
  }
  
  // Combine totals
  const totalBytes = storeTotal.bytes + reactQueryBytes;
  
  // Build breakdown with React Query included
  const breakdown: CacheSizeState['breakdown'] = [
    ...storeBreakdown.map((item: CacheSizeInfo) => ({
      name: item.label,
      key: item.key,
      bytes: item.bytes,
      formatted: item.formatted,
    })),
  ];
  
  // Add React Query to breakdown
  if (reactQueryBytes > 0) {
    breakdown.push({
      name: 'React Query',
      key: REACT_QUERY_CACHE_KEY,
      bytes: reactQueryBytes,
      formatted: formatBytes(reactQueryBytes),
    });
  }
  
  // Sort by size descending
  breakdown.sort((a, b) => b.bytes - a.bytes);
  
  return {
    total: { bytes: totalBytes, formatted: formatBytes(totalBytes) },
    breakdown,
  };
}

/**
 * Print all cached data to console for debugging
 */
function printCacheToConsole(): void {
  // Print store registry data
  printAllStores();
  
  // Also print React Query cache
  console.group('[Cache Debug] React Query');
  try {
    const cacheStr = localStorage.getItem(REACT_QUERY_CACHE_KEY);
    if (cacheStr) {
      const cache = JSON.parse(cacheStr);
      const queries = cache?.clientState?.queries || [];
      
      console.log('Total queries:', queries.length);
      console.log('Cache timestamp:', cache?.timestamp ? new Date(cache.timestamp).toLocaleString() : 'N/A');
      console.log('Total size:', formatBytes(new Blob([cacheStr]).size));
      console.log('---');
      
      // Print each query with its size
      queries.forEach((query: { queryKey: unknown; state: { data: unknown } }, index: number) => {
        const querySize = new Blob([JSON.stringify(query)]).size;
        console.log(`${index + 1}. [${formatBytes(querySize)}]`, query.queryKey);
      });
      
      console.log('---');
      console.log('Full cache object:', cache);
    } else {
      console.log('(empty)');
    }
  } catch (error) {
    console.error('Failed to parse React Query cache', error);
  }
  console.groupEnd();
}

interface SnackbarState { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning'; }

export function Settings() {
  // Use Zustand store instead of context
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const queryClient = useQueryClient();

  // eslint-disable-next-line state-management/prefer-state-architecture -- static data from sync function, not API
  const [models] = useState<AIModelDefinition[]>(getAllModels());
  // eslint-disable-next-line state-management/prefer-state-architecture -- local loading indicator for cache clear action
  const [isClearing, setIsClearing] = useState(false);
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral snackbar notification
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info'
  });
  // eslint-disable-next-line state-management/prefer-state-architecture -- local cache size display
  const [cacheSize, setCacheSize] = useState<CacheSizeState>({ 
    total: { bytes: 0, formatted: '0 KB' },
    breakdown: [],
  });
  // eslint-disable-next-line state-management/prefer-state-architecture -- local UI toggle for breakdown visibility
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Refresh cache size
  const refreshCacheSize = useCallback(() => {
    setCacheSize(getCombinedCacheSize());
  }, []);

  // Calculate cache size on mount and after clearing
  useEffect(() => {
    refreshCacheSize();
  }, [refreshCacheSize]);

  const handleModelChange = (value: string) => { updateSettings({ aiModel: value }); };

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      // Clear server-side cache
      const result = await clearCacheApi({});

      // Clear React Query in-memory cache
      queryClient.clear();
      
      // Clear React Query persisted cache from localStorage
      let clientCacheCleared = true;
      try {
        localStorage.removeItem(REACT_QUERY_CACHE_KEY);
        // Also clear all persisted stores via registry
        clearAllPersistedStores();
      } catch {
        clientCacheCleared = false;
      }

      // Determine overall success and message
      const overallSuccess = result.data?.success && clientCacheCleared;
      let message = result.data?.message || 'Cache operation completed';

      if (result.data?.success && clientCacheCleared) {
        message = 'All caches cleared successfully';
      } else if (result.data?.success && !clientCacheCleared) {
        message = 'Server cache cleared, but failed to clear client cache';
      } else if (!result.data?.success && clientCacheCleared) {
        message = 'Client cache cleared, but failed to clear server cache';
      } else {
        message = 'Failed to clear both server and client caches';
      }

      setSnackbar({
        open: true,
        message,
        severity: overallSuccess ? 'success' : 'warning'
      });
      
      // Refresh cache size after clearing
      refreshCacheSize();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        severity: 'error'
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card className="mt-3 p-4">
        <h2 className="mb-2 text-lg font-medium">Cache Management</h2>
        <p className="mb-3 text-sm text-muted-foreground">Clear the application cache to fetch fresh data from AI models and external services. This will clear both server-side and client-side caches.</p>
        
        {/* Cache Size Display */}
        <div className="mb-3 rounded-md bg-muted p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Client Cache</span>
            <span className="text-sm font-mono">{cacheSize.total.formatted}</span>
          </div>
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-background">
              <div 
                className={`h-full transition-all ${
                  cacheSize.total.bytes / LOCAL_STORAGE_LIMIT > 0.8 
                    ? 'bg-destructive' 
                    : cacheSize.total.bytes / LOCAL_STORAGE_LIMIT > 0.5 
                      ? 'bg-yellow-500' 
                      : 'bg-primary'
                }`}
                style={{ width: `${Math.min((cacheSize.total.bytes / LOCAL_STORAGE_LIMIT) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {((cacheSize.total.bytes / LOCAL_STORAGE_LIMIT) * 100).toFixed(1)}% of ~5MB limit
            </p>
          </div>
          
          {/* Breakdown by store (collapsible) */}
          {cacheSize.breakdown.length > 0 && (
            <div className="mt-3 border-t border-border pt-2">
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Show details ({cacheSize.breakdown.length} stores)</span>
                <span className="text-xs">{showBreakdown ? '▲' : '▼'}</span>
              </button>
              {showBreakdown && (
                <div className="mt-2 space-y-1">
                  {cacheSize.breakdown.map((item) => (
                    <div key={item.key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-mono text-muted-foreground">{item.formatted}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleClearCache} disabled={isClearing}>Clear Cache</Button>
          <Button variant="outline" onClick={printCacheToConsole}>Print to Console</Button>
        </div>
        {isClearing && <LinearProgress className="mt-2" />}

        <Separator className="my-3" />

        <h2 className="mb-2 text-lg font-medium">Cache Behavior</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <Switch checked={settings.offlineMode} onCheckedChange={(v) => updateSettings({ offlineMode: v })} />
            <span>Offline Mode</span>
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={settings.staleWhileRevalidate} onCheckedChange={(v) => updateSettings({ staleWhileRevalidate: v })} />
            <span>Serve Stale While Revalidate</span>
          </label>
          <p className="text-sm text-muted-foreground">When SWR is ON, cached data will be served immediately when available while a background refresh runs.</p>
          <p className="text-sm text-muted-foreground">Offline Mode forces using cache and avoids relying on network.</p>
        </div>

        <h2 className="mt-4 mb-2 text-lg font-medium">AI Model</h2>
        <p className="mb-2 text-sm text-muted-foreground">Select the AI model to use for chat and other AI-powered features.</p>
        <Select value={settings.aiModel} onValueChange={handleModelChange}>
          <SelectTrigger>
            <SelectValue placeholder="AI Model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name} ({model.provider})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {snackbar.open && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[90%] max-w-md -translate-x-1/2">
          <Alert variant={snackbar.severity === 'success' ? 'success' : snackbar.severity === 'warning' ? 'warning' : snackbar.severity === 'info' ? 'info' : 'destructive'}>
            {snackbar.message}
          </Alert>
        </div>
      )}
    </div>
  );
}
