/**
 * PushNavigationBridge
 *
 * Listens for `push-navigate` messages from the service worker (sent by
 * `public/sw-push.js` on `notificationclick`) and performs an SPA
 * navigation via the app router. Renders nothing.
 *
 * Must be rendered inside <RouterProvider> so `useRouter()` resolves.
 */

import { useEffect } from 'react';
import { useRouter } from '../router';

interface PushNavigateMessage {
    type: 'push-navigate';
    url: string;
}

function isPushNavigateMessage(data: unknown): data is PushNavigateMessage {
    if (typeof data !== 'object' || data === null) return false;
    const msg = data as { type?: unknown; url?: unknown };
    return msg.type === 'push-navigate' && typeof msg.url === 'string';
}

export function PushNavigationBridge(): null {
    const { navigate, currentPath } = useRouter();

    useEffect(() => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        const handler = (event: MessageEvent) => {
            if (!isPushNavigateMessage(event.data)) return;
            const target = event.data.url;
            if (!target || target === currentPath) return;
            navigate(target);
        };

        navigator.serviceWorker.addEventListener('message', handler);
        return () => {
            navigator.serviceWorker.removeEventListener('message', handler);
        };
    }, [navigate, currentPath]);

    return null;
}
