import type { PushPlatform } from '@/apis/template/push-notifications/types';

/**
 * Convert a base64 URL-safe VAPID public key to a Uint8Array as required by
 * PushManager.subscribe().
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
        output[i] = rawData.charCodeAt(i);
    }
    return output;
}

/** Detect whether the app is running as a standalone (installed) PWA. */
export function isStandalonePwa(): boolean {
    if (typeof window === 'undefined') return false;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone) return true;
    return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

/** Detect iOS (iPhone / iPad / iPod). iPadOS reports as Mac with touch. */
export function isIos(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    const isIpadOs =
        window.navigator.platform === 'MacIntel' &&
        (window.navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints !==
            undefined &&
        ((window.navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1;
    return isIpadOs;
}

export function detectPlatform(): PushPlatform {
    if (typeof window === 'undefined') return 'unknown';
    if (isIos()) return 'ios';
    const ua = window.navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/Windows|Macintosh|Linux/i.test(ua)) return 'desktop';
    return 'unknown';
}

/**
 * Native push support in the current context.
 * iOS only exposes PushManager inside an installed PWA (16.4+).
 */
export function isPushSupported(): boolean {
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator)) return false;
    if (!('PushManager' in window)) return false;
    if (!('Notification' in window)) return false;
    return true;
}

export function isIosPwaEligible(): boolean {
    return isIos() && isStandalonePwa();
}

export function getVapidPublicKey(): string | null {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    return key && key.length > 0 ? key : null;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission;
}
