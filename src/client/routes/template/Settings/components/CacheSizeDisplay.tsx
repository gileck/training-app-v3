import { useState } from 'react';
import { LOCAL_STORAGE_LIMIT, type CacheSizeState } from '../utils';

interface CacheSizeDisplayProps {
    cacheSize: CacheSizeState;
}

export function CacheSizeDisplay({ cacheSize }: CacheSizeDisplayProps) {
    // eslint-disable-next-line state-management/prefer-state-architecture -- local UI toggle for breakdown visibility
    const [showBreakdown, setShowBreakdown] = useState(false);

    return (
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
    );
}
