/**
 * Server-side Web Push sender.
 *
 * Loads VAPID keys from environment once per process and exposes helpers
 * to push to a single subscription or to every subscription a user owns.
 * Dead subscriptions (404/410) are pruned from the database automatically.
 */

import webpush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { pushSubscriptions } from '@/server/database';
import type { PushSubscriptionDocument } from '@/server/database/collections/template/push-subscriptions/types';

let vapidConfigured = false;
let vapidError: string | null = null;

function ensureVapidConfigured(): void {
    if (vapidConfigured) return;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
        vapidError =
            'Web push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (run `yarn generate-vapid`).';
        return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
}

export function isPushConfigured(): boolean {
    ensureVapidConfigured();
    return vapidConfigured;
}

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
}

export interface PushSendResult {
    endpoint: string;
    success: boolean;
    removed: boolean;
    statusCode?: number;
    error?: string;
}

function toWebPushSubscription(doc: PushSubscriptionDocument): WebPushSubscription {
    return {
        endpoint: doc.endpoint,
        keys: doc.keys,
    };
}

async function sendToOne(
    doc: PushSubscriptionDocument,
    payload: PushPayload
): Promise<PushSendResult> {
    try {
        await webpush.sendNotification(
            toWebPushSubscription(doc),
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24 }
        );
        void pushSubscriptions.touchSubscription(doc.endpoint).catch(() => {});
        return { endpoint: doc.endpoint, success: true, removed: false };
    } catch (err: unknown) {
        const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
                ? Number((err as { statusCode?: number }).statusCode)
                : undefined;
        const message = err instanceof Error ? err.message : String(err);

        // 404 Not Found / 410 Gone = endpoint is permanently invalid
        const isGone = statusCode === 404 || statusCode === 410;
        if (isGone) {
            await pushSubscriptions
                .deleteSubscriptionByEndpoint(doc.endpoint)
                .catch(() => {});
        }

        return {
            endpoint: doc.endpoint,
            success: false,
            removed: isGone,
            statusCode,
            error: message,
        };
    }
}

/**
 * Send a push to every subscription owned by the user.
 * Returns per-endpoint results; never throws for delivery failures.
 */
export async function sendPushToUser(
    userId: string,
    payload: PushPayload
): Promise<PushSendResult[]> {
    ensureVapidConfigured();
    if (!vapidConfigured) {
        throw new Error(vapidError ?? 'Web push not configured');
    }

    const subs = await pushSubscriptions.findSubscriptionsByUser(userId);
    if (subs.length === 0) return [];

    return Promise.all(subs.map((doc) => sendToOne(doc, payload)));
}
