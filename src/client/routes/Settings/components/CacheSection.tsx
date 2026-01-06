/**
 * Cache Management Section Component
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/client/components/ui/button';
import { Switch } from '@/client/components/ui/switch';
import { Separator } from '@/client/components/ui/separator';
import { LinearProgress } from '@/client/components/ui/linear-progress';
import { Input } from '@/client/components/ui/input';
import { Label } from '@/client/components/ui/label';
import { useSettingsStore } from '@/client/features/settings';
import { clearCache as clearCacheApi } from '@/apis/settings/clearCache/client';
import { clearAllPersistedStores } from '@/client/stores';
import {
    REACT_QUERY_CACHE_KEY,
    LOCAL_STORAGE_LIMIT,
    getCombinedCacheSize,
    printCacheToConsole,
    type CacheSizeState,
} from '../utils';

interface CacheSectionProps {
    onSnackbar: (message: string, severity: 'success' | 'error' | 'info' | 'warning') => void;
}

export function CacheSection({ onSnackbar }: CacheSectionProps) {
    const settings = useSettingsStore((state) => state.settings);
    const updateSettings = useSettingsStore((state) => state.updateSettings);
    const queryClient = useQueryClient();

    // eslint-disable-next-line state-management/prefer-state-architecture -- local loading indicator for cache clear action
    const [isClearing, setIsClearing] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI toggle for collapsible section
    const [isCacheBehaviorOpen, setIsCacheBehaviorOpen] = useState(false);
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

            onSnackbar(message, overallSuccess ? 'success' : 'warning');

            // Refresh cache size after clearing
            refreshCacheSize();
        } catch (error) {
            onSnackbar(
                error instanceof Error ? error.message : 'An unknown error occurred',
                'error'
            );
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <>
            <h2 className="mb-2 text-lg font-medium">Cache Management</h2>
            <p className="mb-3 text-sm text-muted-foreground">
                Clear the application cache to fetch fresh data from AI models and external services.
                This will clear both server-side and client-side caches.
            </p>

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
                                        ? 'bg-warning'
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

            <button
                type="button"
                onClick={() => setIsCacheBehaviorOpen(!isCacheBehaviorOpen)}
                className="flex w-full items-center justify-between py-1 text-left"
            >
                <h2 className="text-lg font-medium">Cache Behavior</h2>
                {isCacheBehaviorOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
            </button>

            {isCacheBehaviorOpen && (
                <div className="mt-2 space-y-3">
                    <label className="flex items-center gap-2">
                        <Switch checked={settings.offlineMode} onCheckedChange={(v) => updateSettings({ offlineMode: v })} />
                        <span>Offline Mode</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <Switch checked={settings.staleWhileRevalidate} onCheckedChange={(v) => updateSettings({ staleWhileRevalidate: v })} />
                        <span>Use Cache (SWR)</span>
                    </label>
                    <p className="text-sm text-muted-foreground">
                        {settings.staleWhileRevalidate ? (
                            <>Cached data served instantly, refreshes in background. Offline works.</>
                        ) : (
                            <>Always fetch fresh. Cached data never displayed. <span className="text-destructive font-medium">Offline won&apos;t work.</span></>
                        )}
                    </p>

                    {settings.staleWhileRevalidate && (
                        <div className="mt-3 space-y-3 rounded-md border border-border p-3">
                            <p className="text-sm font-medium">Cache Configuration</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="staleTime" className="text-sm">Stale Time (sec)</Label>
                                    <Input
                                        id="staleTime"
                                        type="number"
                                        min={0}
                                        max={3600}
                                        value={settings.cacheStaleTimeSeconds ?? 30}
                                        onChange={(e) => updateSettings({ cacheStaleTimeSeconds: Math.max(0, parseInt(e.target.value) || 0) })}
                                        className="h-8"
                                    />
                                    <p className="text-xs text-muted-foreground">Default: 30</p>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="gcTime" className="text-sm">Memory (min)</Label>
                                    <Input
                                        id="gcTime"
                                        type="number"
                                        min={1}
                                        max={1440}
                                        value={settings.cacheGcTimeMinutes ?? 30}
                                        onChange={(e) => updateSettings({ cacheGcTimeMinutes: Math.max(1, parseInt(e.target.value) || 1) })}
                                        className="h-8"
                                    />
                                    <p className="text-xs text-muted-foreground">Default: 30</p>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="persistDays" className="text-sm">Persist (days)</Label>
                                    <Input
                                        id="persistDays"
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={settings.cachePersistDays ?? 7}
                                        onChange={(e) => updateSettings({ cachePersistDays: Math.max(1, Math.min(30, parseInt(e.target.value) || 7)) })}
                                        className="h-8"
                                    />
                                    <p className="text-xs text-muted-foreground">Default: 7</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
