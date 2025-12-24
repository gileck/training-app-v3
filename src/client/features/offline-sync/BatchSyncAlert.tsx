import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/client/components/ui/button';
import {
    ChevronDown,
    ChevronUp,
    X,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    CloudOff,
    RefreshCw
} from 'lucide-react';
import { useBatchSyncAlertStore } from './store';

/**
 * Format API name for display (e.g., "todos/create" -> "Create Todo")
 */
function formatApiName(name: string): string {
    const parts = name.split('/');
    if (parts.length !== 2) return name;
    const [entity, action] = parts;
    const formattedAction = action.charAt(0).toUpperCase() + action.slice(1);
    const formattedEntity = entity.charAt(0).toUpperCase() + entity.slice(1).replace(/s$/, '');
    return `${formattedAction} ${formattedEntity}`;
}

/**
 * Global batch sync alert component
 * Shows sync progress, success, and error states for offline mutations
 */
export const BatchSyncAlert: React.FC = () => {
    const { status, totalItems, syncedItems, failures, dismiss } = useBatchSyncAlertStore();
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral expand/collapse state
    const [isExpanded, setIsExpanded] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral animation state
    const [isVisible, setIsVisible] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral auto-dismiss timer state
    const [shouldAutoDismiss, setShouldAutoDismiss] = useState(false);

    // Handle visibility with animation
    useEffect(() => {
        if (status !== 'idle') {
            setIsVisible(true);
            setIsExpanded(false);
            // Auto-dismiss success after 4 seconds
            if (status === 'success') {
                setShouldAutoDismiss(true);
            } else {
                setShouldAutoDismiss(false);
            }
        }
    }, [status]);

    // Auto-dismiss timer for success
    useEffect(() => {
        if (shouldAutoDismiss && status === 'success') {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(dismiss, 300); // Wait for animation
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [shouldAutoDismiss, status, dismiss]);

    const handleDismiss = useCallback(() => {
        setIsVisible(false);
        setTimeout(dismiss, 300); // Wait for animation
    }, [dismiss]);

    if (status === 'idle') {
        return null;
    }

    const getStatusConfig = () => {
        switch (status) {
            case 'syncing':
                return {
                    icon: <Loader2 className="h-5 w-5 animate-spin text-info" />,
                    bgClass: 'bg-info/10 border-info/30',
                    titleClass: 'text-info',
                    title: `Syncing ${totalItems} offline call${totalItems > 1 ? 's' : ''}...`,
                    subtitle: 'Sending queued changes to the server',
                };
            case 'success':
                return {
                    icon: <CheckCircle2 className="h-5 w-5 text-success" />,
                    bgClass: 'bg-success/10 border-success/30',
                    titleClass: 'text-success',
                    title: `All ${syncedItems.length} call${syncedItems.length > 1 ? 's' : ''} synced successfully`,
                    subtitle: 'Your offline changes have been saved',
                };
            case 'partial':
                return {
                    icon: <AlertTriangle className="h-5 w-5 text-warning" />,
                    bgClass: 'bg-warning/10 border-warning/30',
                    titleClass: 'text-warning',
                    title: `${syncedItems.length} synced, ${failures.length} failed`,
                    subtitle: 'Some offline changes could not be saved',
                };
            case 'error':
                return {
                    icon: <CloudOff className="h-5 w-5 text-destructive" />,
                    bgClass: 'bg-destructive/10 border-destructive/30',
                    titleClass: 'text-destructive',
                    title: `${failures.length} call${failures.length > 1 ? 's' : ''} failed to sync`,
                    subtitle: 'Your offline changes could not be saved',
                };
            default:
                return {
                    icon: null,
                    bgClass: '',
                    titleClass: '',
                    title: '',
                    subtitle: '',
                };
        }
    };

    const config = getStatusConfig();
    const hasFailures = failures.length > 0;
    const hasSuccesses = syncedItems.length > 0 && status !== 'syncing';

    return (
        <div
            className={`
                fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md
                transition-all duration-300 ease-out
                ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
            `}
        >
            <div
                className={`
                    relative overflow-hidden rounded-2xl border backdrop-blur-xl
                    shadow-lg shadow-black/5 dark:shadow-black/20
                    ${config.bgClass}
                `}
            >
                {/* Animated background shimmer for syncing state */}
                {status === 'syncing' && (
                    <div className="absolute inset-0 overflow-hidden">
                        <div
                            className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"
                            style={{ animationTimingFunction: 'ease-in-out' }}
                        />
                    </div>
                )}

                <div className="relative p-4">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">
                            {config.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className={`font-semibold leading-tight ${config.titleClass}`}>
                                {config.title}
                            </h3>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                {config.subtitle}
                            </p>
                        </div>
                        {status !== 'syncing' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 flex-shrink-0 rounded-full p-0 hover:bg-foreground/10"
                                onClick={handleDismiss}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Expandable details */}
                    {(hasFailures || hasSuccesses) && (
                        <div className="mt-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 rounded-lg px-3 text-xs font-medium hover:bg-foreground/5"
                                onClick={() => setIsExpanded(!isExpanded)}
                            >
                                {isExpanded ? (
                                    <>
                                        <ChevronUp className="h-3.5 w-3.5" />
                                        Hide Details
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="h-3.5 w-3.5" />
                                        View Details
                                    </>
                                )}
                            </Button>

                            {isExpanded && (
                                <div className="mt-3 space-y-3">
                                    {/* Failures section */}
                                    {hasFailures && (
                                        <div className="rounded-xl bg-destructive/5 p-3">
                                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-destructive">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Failed ({failures.length})
                                            </div>
                                            <div className="max-h-40 space-y-2 overflow-y-auto">
                                                {failures.map((failure) => (
                                                    <div
                                                        key={failure.id}
                                                        className="rounded-lg bg-background/50 p-2.5"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className="text-sm font-medium text-foreground">
                                                                {formatApiName(failure.name)}
                                                            </span>
                                                            <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                                        </div>
                                                        <p className="mt-1 text-xs text-destructive">
                                                            {failure.error}
                                                        </p>
                                                        {failure.params && Object.keys(failure.params).length > 0 && (
                                                            <div className="mt-2 rounded bg-muted/50 px-2 py-1.5">
                                                                <code className="block max-w-full truncate text-xs text-muted-foreground">
                                                                    {JSON.stringify(failure.params).slice(0, 80)}
                                                                    {JSON.stringify(failure.params).length > 80 ? '…' : ''}
                                                                </code>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Successes section */}
                                    {hasSuccesses && (
                                        <div className="rounded-xl bg-success/5 p-3">
                                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Synced ({syncedItems.length})
                                            </div>
                                            <div className="max-h-32 space-y-1.5 overflow-y-auto">
                                                {syncedItems.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center gap-2 rounded-lg bg-background/50 px-2.5 py-1.5 text-sm"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                                                        <span className="text-foreground">
                                                            {formatApiName(item.name)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Progress bar for syncing state */}
                {status === 'syncing' && (
                    <div className="h-1 w-full overflow-hidden bg-info/20">
                        <div className="h-full w-1/3 animate-[progress_1.5s_ease-in-out_infinite] bg-info" />
                    </div>
                )}
            </div>
        </div>
    );
};

