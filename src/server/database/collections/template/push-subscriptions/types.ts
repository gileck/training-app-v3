import type { ObjectId } from 'mongodb';

export type PushPlatform = 'ios' | 'android' | 'desktop' | 'unknown';

export interface PushSubscriptionKeys {
    p256dh: string;
    auth: string;
}

export interface PushSubscriptionDocument {
    _id: ObjectId;
    userId: ObjectId;
    endpoint: string;
    keys: PushSubscriptionKeys;
    platform: PushPlatform;
    userAgent?: string;
    createdAt: Date;
    lastUsedAt: Date;
}

export type PushSubscriptionCreate = Omit<PushSubscriptionDocument, '_id'>;

export interface PushSubscriptionClient {
    id: string;
    endpoint: string;
    platform: PushPlatform;
    createdAt: string;
    lastUsedAt: string;
}
