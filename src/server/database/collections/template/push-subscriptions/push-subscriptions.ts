import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import type {
    PushSubscriptionDocument,
    PushSubscriptionCreate,
    PushPlatform,
} from './types';

const getCollection = async (): Promise<Collection<PushSubscriptionDocument>> => {
    const db = await getDb();
    return db.collection<PushSubscriptionDocument>('push_subscriptions');
};

const toId = (id: ObjectId | string): ObjectId =>
    typeof id === 'string' ? new ObjectId(id) : id;

/**
 * Upsert a subscription by its endpoint (unique).
 * Re-subscribing from the same device replaces the previous record.
 */
export const upsertSubscription = async (
    userId: ObjectId | string,
    input: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
        platform: PushPlatform;
        userAgent?: string;
    }
): Promise<PushSubscriptionDocument> => {
    const collection = await getCollection();
    const now = new Date();
    const userIdObj = toId(userId);

    await collection.updateOne(
        { endpoint: input.endpoint },
        {
            $set: {
                userId: userIdObj,
                endpoint: input.endpoint,
                keys: input.keys,
                platform: input.platform,
                userAgent: input.userAgent,
                lastUsedAt: now,
            },
            $setOnInsert: {
                createdAt: now,
            },
        },
        { upsert: true }
    );

    const doc = await collection.findOne({ endpoint: input.endpoint });
    if (!doc) {
        throw new Error('Failed to upsert push subscription');
    }
    return doc;
};

export const findSubscriptionsByUser = async (
    userId: ObjectId | string
): Promise<PushSubscriptionDocument[]> => {
    const collection = await getCollection();
    return collection.find({ userId: toId(userId) }).toArray();
};

export const countSubscriptionsByUser = async (
    userId: ObjectId | string
): Promise<number> => {
    const collection = await getCollection();
    return collection.countDocuments({ userId: toId(userId) });
};

export const deleteSubscriptionByEndpoint = async (
    endpoint: string
): Promise<boolean> => {
    const collection = await getCollection();
    const result = await collection.deleteOne({ endpoint });
    return result.deletedCount > 0;
};

export const deleteSubscriptionByEndpointForUser = async (
    userId: ObjectId | string,
    endpoint: string
): Promise<boolean> => {
    const collection = await getCollection();
    const result = await collection.deleteOne({
        userId: toId(userId),
        endpoint,
    });
    return result.deletedCount > 0;
};

export const touchSubscription = async (endpoint: string): Promise<void> => {
    const collection = await getCollection();
    await collection.updateOne(
        { endpoint },
        { $set: { lastUsedAt: new Date() } }
    );
};

export const createIndexes = async (): Promise<void> => {
    const collection = await getCollection();
    await collection.createIndex({ endpoint: 1 }, { unique: true });
    await collection.createIndex({ userId: 1 });
};

export type { PushSubscriptionCreate };
