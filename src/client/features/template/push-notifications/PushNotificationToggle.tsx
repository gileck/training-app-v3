/**
 * PushNotificationToggle
 *
 * Settings-row component that enables/disables Web Push for the current user
 * on this device. Handles iOS's home-screen-only constraint with an inline
 * explanation when running outside a standalone PWA.
 */

import { Switch } from '@/client/components/template/ui/switch';
import { Label } from '@/client/components/template/ui/label';
import { Button } from '@/client/components/template/ui/button';
import { Bell, Info, Loader2 } from 'lucide-react';
import { toast } from '@/client/components/template/ui/toast';
import { errorToast } from '../error-tracking';
import {
    usePushStatusQuery,
    useLocalPushSubscriptionQuery,
    useSubscribePush,
    useUnsubscribePush,
    useSendTestPush,
} from './hooks';
import {
    getNotificationPermission,
    getVapidPublicKey,
    isIos,
    isIosPwaEligible,
    isPushSupported,
} from './utils';

export function PushNotificationToggle() {
    const statusQuery = usePushStatusQuery();
    const localSubQuery = useLocalPushSubscriptionQuery();
    const subscribe = useSubscribePush();
    const unsubscribe = useUnsubscribePush();
    const sendTest = useSendTestPush();

    const configured = statusQuery.data?.configured ?? Boolean(getVapidPublicKey());
    const localEndpoint = localSubQuery.data?.endpoint ?? null;
    // Toggle reflects THIS device's subscription state. Server-side count is
    // shown separately. Server can have stale entries from other devices that
    // do not exist here; those should not lock the toggle into ON.
    const subscribed = Boolean(localEndpoint);
    const serverEndpoints = statusQuery.data?.endpoints ?? 0;
    const hasStaleServerSubs = !subscribed && serverEndpoints > 0;

    const supported = isPushSupported();
    const iosDevice = isIos();
    const iosBlocked = iosDevice && !isIosPwaEligible();
    const permission = getNotificationPermission();
    const permissionDenied = permission === 'denied';

    const busy = subscribe.isPending || unsubscribe.isPending;

    const handleToggle = async (checked: boolean) => {
        try {
            if (checked) {
                await subscribe.mutateAsync();
                toast.success('Notifications enabled on this device.');
            } else {
                await unsubscribe.mutateAsync();
                toast.success('Notifications disabled.');
            }
        } catch (err) {
            errorToast(
                checked ? 'Could not enable notifications' : 'Could not disable notifications',
                err
            );
        }
    };

    const handleSendTest = async () => {
        try {
            const result = await sendTest.mutateAsync(undefined);
            const sent = result?.sent ?? 0;
            if (sent > 0) {
                toast.success(`Test sent to ${sent} device${sent > 1 ? 's' : ''}.`);
            } else {
                toast.error('No devices received the test. Try re-enabling notifications.');
            }
        } catch (err) {
            errorToast('Could not send test notification', err);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <Bell className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0">
                        <Label htmlFor="push-notifications-toggle" className="text-base">
                            Push notifications
                        </Label>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Receive notifications on this device, even when the app isn&apos;t open.
                        </p>
                    </div>
                </div>
                <Switch
                    id="push-notifications-toggle"
                    checked={subscribed}
                    disabled={busy || !supported || iosBlocked || !configured || permissionDenied}
                    onCheckedChange={handleToggle}
                />
            </div>

            {busy && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {subscribe.isPending ? 'Enabling…' : 'Disabling…'}
                </p>
            )}

            {!configured && (
                <InfoRow>
                    Push notifications are not configured on this deployment. Ask an
                    administrator to generate VAPID keys (<code>yarn generate-vapid</code>).
                </InfoRow>
            )}

            {configured && !supported && !iosDevice && (
                <InfoRow>
                    This browser does not support web push notifications.
                </InfoRow>
            )}

            {configured && iosBlocked && (
                <InfoRow>
                    On iOS, notifications only work from the installed app. Tap the Share
                    button in Safari and choose <strong>Add to Home Screen</strong>, then
                    open the app from your home screen to enable notifications.
                </InfoRow>
            )}

            {configured && permissionDenied && (
                <InfoRow>
                    Notifications are blocked in your browser settings. Enable them for
                    this site to turn on push notifications.
                </InfoRow>
            )}

            {subscribed && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                        Active on {serverEndpoints} device{serverEndpoints === 1 ? '' : 's'}.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSendTest}
                        disabled={sendTest.isPending}
                    >
                        {sendTest.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                Sending…
                            </>
                        ) : (
                            'Send test'
                        )}
                    </Button>
                </div>
            )}

            {!subscribed && hasStaleServerSubs && (
                <InfoRow>
                    Notifications are off on this device, but {serverEndpoints} stale
                    server subscription{serverEndpoints === 1 ? '' : 's'} from previous
                    sessions or other devices may still exist. They&apos;ll be cleaned up
                    automatically the next time the server tries to send to them.
                </InfoRow>
            )}
        </div>
    );
}

function InfoRow({ children }: { children: React.ReactNode }) {
    return (
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}
