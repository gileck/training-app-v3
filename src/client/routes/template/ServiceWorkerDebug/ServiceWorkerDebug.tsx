/**
 * Service Worker / Push Notifications Debug Page (admin-only).
 *
 * Shows the full client-side picture for debugging push notification issues:
 * SW registration state, push subscription, notification permission, platform
 * detection (iOS / standalone), asset reachability (/sw-push.js, /sw.js), and
 * the server's view of the current user's subscriptions.
 *
 * Provides actions to refresh, send a test push, re-register the SW, and
 * unregister + reload (nuclear reset).
 */

import { useCallback, useEffect, useState } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/client/components/template/ui/card';
import { Button } from '@/client/components/template/ui/button';
import { Badge } from '@/client/components/template/ui/badge';
import { toast } from '@/client/components/template/ui/toast';
import { errorToast } from '@/client/features';
import {
    usePushStatusQuery,
    useSendTestPush,
} from '@/client/features/template/push-notifications';
import {
    Bug,
    Copy,
    Loader2,
    RefreshCcw,
    RotateCcw,
    Send,
    Trash2,
} from 'lucide-react';
import {
    collectAssetInfo,
    collectPermissionInfo,
    collectPlatformInfo,
    collectPushSubscriptionInfo,
    collectSwInfo,
    vapidPublicKeyConfigured,
} from './collect';
import type { Diagnostics } from './types';

function shortenEndpoint(endpoint?: string): string {
    if (!endpoint) return '—';
    if (endpoint.length <= 80) return endpoint;
    return `${endpoint.slice(0, 60)}…${endpoint.slice(-12)}`;
}

function StatusBadge({ ok, label }: { ok: boolean | null; label?: string }) {
    if (ok === null) return <Badge variant="outline">unknown</Badge>;
    return (
        <Badge variant={ok ? 'default' : 'destructive'}>
            {label ?? (ok ? 'yes' : 'no')}
        </Badge>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
            <span className="text-muted-foreground shrink-0">{label}</span>
            <span className="text-right break-all font-mono text-xs">{value}</span>
        </div>
    );
}

export function ServiceWorkerDebug() {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral diagnostic snapshot, refreshed on demand
    const [diag, setDiag] = useState<Diagnostics | null>(null);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral in-flight indicator for diagnostics refresh
    const [refreshing, setRefreshing] = useState(false);
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral in-flight indicator for SW lifecycle actions
    const [acting, setActing] = useState(false);

    const statusQuery = usePushStatusQuery();
    const sendTest = useSendTestPush();

    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const [sw, push, assets] = await Promise.all([
                collectSwInfo(),
                collectPushSubscriptionInfo(),
                collectAssetInfo(),
            ]);
            setDiag({
                capturedAt: new Date().toISOString(),
                sw,
                push,
                permission: collectPermissionInfo(),
                platform: collectPlatformInfo(),
                assets,
                server: {
                    configured: statusQuery.data?.configured ?? null,
                    subscribed: statusQuery.data?.subscribed ?? null,
                    endpoints: statusQuery.data?.endpoints ?? null,
                    error: statusQuery.error
                        ? String((statusQuery.error as Error).message ?? statusQuery.error)
                        : undefined,
                },
                vapidPublicKeyConfigured: vapidPublicKeyConfigured(),
            });
        } catch (err) {
            errorToast('Failed to collect diagnostics', err);
        } finally {
            setRefreshing(false);
        }
    }, [statusQuery.data, statusQuery.error]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleSendTest = async () => {
        try {
            const result = await sendTest.mutateAsync({
                title: 'Debug test',
                body: `Sent at ${new Date().toLocaleTimeString()}.`,
            });
            const sent = result?.sent ?? 0;
            if (sent > 0) toast.success(`Test sent to ${sent} device${sent > 1 ? 's' : ''}.`);
            else toast.error('No devices received the test.');
        } catch (err) {
            errorToast('Could not send test push', err);
        }
    };

    const handleReRegister = async () => {
        if (!('serviceWorker' in navigator)) return;
        setActing(true);
        try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) {
                toast.error('No service worker registered.');
                return;
            }
            await reg.update();
            toast.success('Service worker update triggered.');
            await refresh();
        } catch (err) {
            errorToast('Service worker update failed', err);
        } finally {
            setActing(false);
        }
    };

    const handleUnregister = async () => {
        if (!('serviceWorker' in navigator)) return;
        if (!window.confirm('Unregister service worker and reload?')) return;
        setActing(true);
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
            window.location.reload();
        } catch (err) {
            errorToast('Unregister failed', err);
            setActing(false);
        }
    };

    const handleCopyDiagnostics = async () => {
        if (!diag) return;
        try {
            await navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
            toast.success('Diagnostics copied to clipboard.');
        } catch (err) {
            errorToast('Could not copy', err);
        }
    };

    return (
        <div className="mx-auto max-w-3xl py-4 px-2 sm:px-4 pb-20 sm:pb-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Bug className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <h1 className="text-xl font-semibold">Service Worker Debug</h1>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void refresh()}
                    disabled={refreshing}
                >
                    {refreshing ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                        <RefreshCcw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Refresh
                </Button>
            </div>

            {!diag ? (
                <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        Collecting diagnostics…
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Service Worker</CardTitle>
                        </CardHeader>
                        <CardContent className="divide-y divide-border">
                            <Row label="Supported" value={<StatusBadge ok={diag.sw.supported} />} />
                            <Row label="Registered" value={<StatusBadge ok={diag.sw.registered} />} />
                            <Row label="Active state" value={diag.sw.state ?? '—'} />
                            <Row
                                label="Controlling page"
                                value={<StatusBadge ok={diag.sw.isControlling} />}
                            />
                            <Row label="Scope" value={diag.sw.scope ?? '—'} />
                            <Row label="Script URL" value={diag.sw.scriptURL ?? '—'} />
                            {diag.sw.waitingScriptURL && (
                                <Row label="Waiting" value={diag.sw.waitingScriptURL} />
                            )}
                            {diag.sw.installingScriptURL && (
                                <Row label="Installing" value={diag.sw.installingScriptURL} />
                            )}
                            <Row
                                label="PushManager"
                                value={<StatusBadge ok={diag.sw.pushManagerSupported} />}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Push Subscription (this device)</CardTitle>
                        </CardHeader>
                        <CardContent className="divide-y divide-border">
                            <Row label="Subscribed" value={<StatusBadge ok={diag.push.subscribed} />} />
                            <Row label="Endpoint" value={shortenEndpoint(diag.push.endpoint)} />
                            <Row
                                label="Keys present"
                                value={<StatusBadge ok={diag.push.keysPresent} />}
                            />
                            <Row
                                label="Expiration"
                                value={
                                    diag.push.expirationTime
                                        ? new Date(diag.push.expirationTime).toLocaleString()
                                        : 'never'
                                }
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Notification Permission</CardTitle>
                        </CardHeader>
                        <CardContent className="divide-y divide-border">
                            <Row
                                label="Notification API"
                                value={<StatusBadge ok={diag.permission.notificationSupported} />}
                            />
                            <Row label="Permission" value={diag.permission.permission} />
                            <Row
                                label="Push API"
                                value={<StatusBadge ok={diag.permission.pushApiSupported} />}
                            />
                            <Row
                                label="Secure context (HTTPS)"
                                value={<StatusBadge ok={diag.permission.secureContext} />}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Platform</CardTitle>
                        </CardHeader>
                        <CardContent className="divide-y divide-border">
                            <Row label="Platform" value={diag.platform.platform} />
                            <Row label="Standalone (PWA)" value={<StatusBadge ok={diag.platform.isStandalone} />} />
                            <Row label="iOS" value={<StatusBadge ok={diag.platform.isIos} />} />
                            {diag.platform.isIos && (
                                <Row
                                    label="iOS push eligible"
                                    value={<StatusBadge ok={diag.platform.isIosPwaEligible} />}
                                />
                            )}
                            {diag.platform.iosVersion && (
                                <Row label="iOS version" value={diag.platform.iosVersion} />
                            )}
                            <Row label="Max touch points" value={String(diag.platform.maxTouchPoints ?? '—')} />
                            <Row label="User agent" value={diag.platform.userAgent} />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">SW Assets</CardTitle>
                        </CardHeader>
                        <CardContent className="divide-y divide-border">
                            <Row
                                label="/sw.js"
                                value={
                                    <span>
                                        <StatusBadge ok={diag.assets.swJsReachable} />
                                        {diag.assets.swJsStatus !== undefined && (
                                            <span className="ml-2">{diag.assets.swJsStatus}</span>
                                        )}
                                    </span>
                                }
                            />
                            <Row
                                label="/sw-push.js"
                                value={
                                    <span>
                                        <StatusBadge ok={diag.assets.swPushReachable} />
                                        {diag.assets.swPushStatus !== undefined && (
                                            <span className="ml-2">{diag.assets.swPushStatus}</span>
                                        )}
                                    </span>
                                }
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Server</CardTitle>
                        </CardHeader>
                        <CardContent className="divide-y divide-border">
                            <Row
                                label="VAPID public key (client)"
                                value={<StatusBadge ok={diag.vapidPublicKeyConfigured} />}
                            />
                            <Row
                                label="VAPID configured (server)"
                                value={<StatusBadge ok={diag.server.configured} />}
                            />
                            <Row
                                label="Server says subscribed"
                                value={<StatusBadge ok={diag.server.subscribed} />}
                            />
                            <Row
                                label="Server endpoint count"
                                value={diag.server.endpoints ?? '—'}
                            />
                            {diag.server.error && (
                                <Row label="Status fetch error" value={diag.server.error} />
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSendTest}
                                disabled={sendTest.isPending}
                            >
                                {sendTest.isPending ? (
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Send className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                Send test push
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleReRegister}
                                disabled={acting}
                            >
                                <RotateCcw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                Update SW
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleCopyDiagnostics}
                            >
                                <Copy className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                Copy diagnostics
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={handleUnregister}
                                disabled={acting}
                            >
                                <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                                Unregister & reload
                            </Button>
                        </CardContent>
                    </Card>

                    <p className="text-center text-xs text-muted-foreground">
                        Captured {new Date(diag.capturedAt).toLocaleString()}
                    </p>
                </>
            )}
        </div>
    );
}
