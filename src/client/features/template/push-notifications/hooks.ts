import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    subscribePush,
    unsubscribePush,
    getPushStatus,
    sendTestPush,
} from '@/apis/template/push-notifications/client';
import { API_PUSH_GET_STATUS } from '@/apis/template/push-notifications';
import { usePushNotificationsStore } from './store';
import { detectPlatform, getVapidPublicKey, urlBase64ToUint8Array } from './utils';

async function getRegistration(): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported in this browser.');
    }
    const reg = await navigator.serviceWorker.ready;
    if (!reg) {
        throw new Error('Service worker is not registered yet. Reload and try again.');
    }
    return reg;
}

function subscriptionToPayload(sub: PushSubscription) {
    const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
    };
    const endpoint = json.endpoint ?? sub.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
        throw new Error('Invalid push subscription — missing endpoint or keys.');
    }
    return { endpoint, keys: { p256dh, auth } };
}

export function usePushStatusQuery() {
    return useQuery({
        queryKey: [API_PUSH_GET_STATUS],
        queryFn: async () => {
            const res = await getPushStatus();
            if (res.data?.error) throw new Error(res.data.error);
            return res.data;
        },
    });
}

const LOCAL_PUSH_SUB_QUERY_KEY = ['push-notifications', 'local-subscription'] as const;

/**
 * Returns the current device's local PushSubscription endpoint (or null if
 * the device isn't subscribed). This is the source of truth for the toggle —
 * the server can have stale subscriptions from other devices that no longer
 * exist, so a server-side `subscribed: true` doesn't imply *this* device is
 * subscribed.
 */
export function useLocalPushSubscriptionQuery() {
    return useQuery({
        queryKey: LOCAL_PUSH_SUB_QUERY_KEY,
        queryFn: async (): Promise<{ endpoint: string | null }> => {
            if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
                return { endpoint: null };
            }
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) return { endpoint: null };
            const sub = await reg.pushManager.getSubscription();
            return { endpoint: sub?.endpoint ?? null };
        },
        // Local-only check; refetch is cheap. Avoid SSR.
        enabled: typeof window !== 'undefined',
    });
}

export function useSubscribePush() {
    const queryClient = useQueryClient();
    const setSubscribed = usePushNotificationsStore((s) => s.setSubscribed);

    return useMutation({
        mutationFn: async () => {
            const vapidKey = getVapidPublicKey();
            if (!vapidKey) {
                throw new Error(
                    'Push notifications are not configured on this deployment.'
                );
            }

            // Permission must be requested from a user gesture. Call this
            // synchronously at the top of the handler — do NOT await anything
            // before this that could break the gesture chain.
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Notification permission was not granted.');
            }

            const registration = await getRegistration();

            // Reuse existing subscription if present; otherwise create a new one.
            let sub = await registration.pushManager.getSubscription();
            if (!sub) {
                const keyBytes = urlBase64ToUint8Array(vapidKey);
                sub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: keyBytes.buffer.slice(
                        keyBytes.byteOffset,
                        keyBytes.byteOffset + keyBytes.byteLength
                    ) as ArrayBuffer,
                });
            }

            const { endpoint, keys } = subscriptionToPayload(sub);
            const res = await subscribePush({
                endpoint,
                keys,
                platform: detectPlatform(),
                userAgent: navigator.userAgent,
            });
            if (res.data?.error) throw new Error(res.data.error);

            return { endpoint };
        },
        onSuccess: ({ endpoint }) => {
            setSubscribed(true, endpoint);
            queryClient.invalidateQueries({ queryKey: [API_PUSH_GET_STATUS] });
            queryClient.invalidateQueries({ queryKey: LOCAL_PUSH_SUB_QUERY_KEY });
        },
    });
}

export function useUnsubscribePush() {
    const queryClient = useQueryClient();
    const setSubscribed = usePushNotificationsStore((s) => s.setSubscribed);

    return useMutation({
        mutationFn: async () => {
            const registration = await getRegistration();
            const sub = await registration.pushManager.getSubscription();
            const endpoint = sub?.endpoint;

            if (sub) {
                try {
                    await sub.unsubscribe();
                } catch {
                    // ignore; we still want to clear the server-side record
                }
            }

            // Always tell the server to remove the endpoint, even if there
            // was no local sub — covers the case where this device's server
            // entry is stale (no matching local sub) and the user wants to
            // clear it. If no endpoint at all, this is a no-op.
            if (endpoint) {
                const res = await unsubscribePush({ endpoint });
                if (res.data?.error) throw new Error(res.data.error);
            }

            return { endpoint: endpoint ?? null };
        },
        onSuccess: () => {
            setSubscribed(false, null);
            queryClient.invalidateQueries({ queryKey: [API_PUSH_GET_STATUS] });
            queryClient.invalidateQueries({ queryKey: LOCAL_PUSH_SUB_QUERY_KEY });
        },
    });
}

export function useSendTestPush() {
    return useMutation({
        mutationFn: async (input?: { title?: string; body?: string; url?: string }) => {
            const res = await sendTestPush(input ?? {});
            if (res.data?.error) throw new Error(res.data.error);
            return res.data;
        },
    });
}
