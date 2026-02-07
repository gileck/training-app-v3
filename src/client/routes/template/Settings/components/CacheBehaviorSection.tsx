import { Switch } from '@/client/components/template/ui/switch';
import { Input } from '@/client/components/template/ui/input';
import { Label } from '@/client/components/template/ui/label';
import type { Settings } from '@/client/features/template/settings/types';

interface CacheBehaviorSectionProps {
    settings: Settings;
    updateSettings: (updates: Partial<Settings>) => void;
}

export function CacheBehaviorSection({ settings, updateSettings }: CacheBehaviorSectionProps) {
    return (
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
    );
}
