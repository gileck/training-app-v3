/**
 * Pure browser-side diagnostics collection. No React, no API calls.
 * Each helper returns its slice; ServiceWorkerDebug glues them together.
 */

import {
    detectPlatform,
    getNotificationPermission,
    getVapidPublicKey,
    isIos,
    isIosPwaEligible,
    isStandalonePwa,
} from '@/client/features/template/push-notifications';
import type {
    PermissionInfo,
    PlatformInfo,
    PushSubscriptionInfo,
    SwAssetInfo,
    SwRegistrationInfo,
} from './types';

export function collectPermissionInfo(): PermissionInfo {
    if (typeof window === 'undefined') {
        return {
            notificationSupported: false,
            permission: 'unsupported',
            pushApiSupported: false,
            secureContext: false,
        };
    }
    return {
        notificationSupported: 'Notification' in window,
        permission: getNotificationPermission(),
        pushApiSupported: 'PushManager' in window,
        secureContext: window.isSecureContext,
    };
}

function detectIosVersion(ua: string): string | undefined {
    const m = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
    if (!m) return undefined;
    return [m[1], m[2], m[3]].filter(Boolean).join('.');
}

export function collectPlatformInfo(): PlatformInfo {
    if (typeof navigator === 'undefined') {
        return {
            userAgent: '',
            platform: 'unknown',
            isStandalone: false,
            isIos: false,
            isIosPwaEligible: false,
        };
    }
    const ua = navigator.userAgent || '';
    const ios = isIos();
    return {
        userAgent: ua,
        platform: detectPlatform(),
        isStandalone: isStandalonePwa(),
        isIos: ios,
        isIosPwaEligible: isIosPwaEligible(),
        iosVersion: ios ? detectIosVersion(ua) : undefined,
        maxTouchPoints: (navigator as Navigator & { maxTouchPoints?: number })
            .maxTouchPoints,
    };
}

export async function collectSwInfo(): Promise<SwRegistrationInfo> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return {
            supported: false,
            registered: false,
            isControlling: false,
            pushManagerSupported: false,
        };
    }

    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
        return {
            supported: true,
            registered: false,
            isControlling: Boolean(navigator.serviceWorker.controller),
            pushManagerSupported: 'PushManager' in window,
        };
    }

    const active = reg.active;
    const installing = reg.installing;
    const waiting = reg.waiting;

    return {
        supported: true,
        registered: true,
        scope: reg.scope,
        scriptURL: active?.scriptURL ?? installing?.scriptURL ?? waiting?.scriptURL,
        state: active?.state ?? installing?.state ?? waiting?.state,
        isControlling: Boolean(navigator.serviceWorker.controller),
        updateViaCache: reg.updateViaCache,
        waitingScriptURL: waiting?.scriptURL,
        installingScriptURL: installing?.scriptURL,
        pushManagerSupported: 'PushManager' in window,
    };
}

export async function collectPushSubscriptionInfo(): Promise<PushSubscriptionInfo> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return { subscribed: false, keysPresent: false };
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { subscribed: false, keysPresent: false };

    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { subscribed: false, keysPresent: false };

    const json = sub.toJSON() as {
        endpoint?: string;
        expirationTime?: number | null;
        keys?: { p256dh?: string; auth?: string };
    };

    return {
        subscribed: true,
        endpoint: json.endpoint ?? sub.endpoint,
        expirationTime: json.expirationTime ?? sub.expirationTime ?? null,
        keysPresent: Boolean(json.keys?.p256dh && json.keys?.auth),
    };
}

async function probe(url: string): Promise<{ ok: boolean; status: number }> {
    try {
        const res = await fetch(url, { method: 'GET', cache: 'no-store' });
        return { ok: res.ok, status: res.status };
    } catch {
        return { ok: false, status: 0 };
    }
}

export async function collectAssetInfo(): Promise<SwAssetInfo> {
    if (typeof window === 'undefined') {
        return { swPushReachable: null, swJsReachable: null };
    }
    const [push, sw] = await Promise.all([probe('/sw-push.js'), probe('/sw.js')]);
    return {
        swPushReachable: push.ok,
        swPushStatus: push.status || undefined,
        swJsReachable: sw.ok,
        swJsStatus: sw.status || undefined,
    };
}

export function vapidPublicKeyConfigured(): boolean {
    return Boolean(getVapidPublicKey());
}
