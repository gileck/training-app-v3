/**
 * Cache Management Section Component
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { Separator } from '@/client/components/template/ui/separator';
import { LinearProgress } from '@/client/components/template/ui/linear-progress';
import { useSettingsStore } from '@/client/features';
import { clearCache as clearCacheApi } from '@/apis/template/settings/clearCache/client';
import { clearAllPersistedStores } from '@/client/stores';
import { REACT_QUERY_CACHE_KEY, getCombinedCacheSize, printCacheToConsole, type CacheSizeState } from '../utils';
import { CacheSizeDisplay } from './CacheSizeDisplay';
import { CacheBehaviorSection } from './CacheBehaviorSection';

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

    const refreshCacheSize = useCallback(() => {
        setCacheSize(getCombinedCacheSize());
    }, []);

    useEffect(() => {
        refreshCacheSize();
    }, [refreshCacheSize]);

    const handleClearCache = async () => {
        setIsClearing(true);
        try {
            const result = await clearCacheApi({});
            queryClient.clear();

            let clientCacheCleared = true;
            try {
                localStorage.removeItem(REACT_QUERY_CACHE_KEY);
                clearAllPersistedStores();
            } catch {
                clientCacheCleared = false;
            }

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

            <CacheSizeDisplay cacheSize={cacheSize} />

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
                <CacheBehaviorSection settings={settings} updateSettings={updateSettings} />
            )}
        </>
    );
}
