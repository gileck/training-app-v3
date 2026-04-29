/* eslint-disable no-undef */
/**
 * Web Push handlers for the app.
 *
 * This file is imported into the generated sw.js via next-pwa's `importScripts`
 * option (see config/next/next.template.ts). It must stay valid plain JS.
 *
 * Navigation strategy:
 *   - If a client window is already open, we focus it AND postMessage a
 *     `push-navigate` event so the client-side router can do an SPA
 *     navigation. `WindowClient.navigate()` is unreliable on iOS and also
 *     breaks with SPA URL rewrites, so we don't use it.
 *   - If no client is open, openWindow() launches the PWA with the target
 *     URL; the React router picks up `window.location.pathname` on mount.
 */

self.addEventListener('push', (event) => {
    let payload = {};
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (_err) {
            payload = { title: 'Notification', body: event.data.text() };
        }
    }

    const title = payload.title || 'Notification';
    const options = {
        body: payload.body || '',
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-96x96.png',
        tag: payload.tag,
        data: {
            url: payload.url || '/',
            ...(payload.data || {}),
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl =
        (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        (async () => {
            const allClients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true,
            });

            // Reuse an existing same-origin client if one is already open.
            let client = null;
            for (const c of allClients) {
                try {
                    const clientUrl = new URL(c.url);
                    if (clientUrl.origin === self.location.origin) {
                        client = c;
                        break;
                    }
                } catch (_err) {
                    // Ignore malformed client URLs.
                }
            }

            if (client) {
                if ('focus' in client) {
                    try {
                        await client.focus();
                    } catch (_err) {
                        // ignore
                    }
                }
                // Tell the running SPA to navigate via its router.
                try {
                    client.postMessage({ type: 'push-navigate', url: targetUrl });
                } catch (_err) {
                    // ignore — worst case, user sees the last page
                }
                return;
            }

            // Fresh open: the URL becomes the initial pathname for the
            // React app to pick up on mount.
            if (self.clients.openWindow) {
                await self.clients.openWindow(targetUrl);
            }
        })()
    );
});
