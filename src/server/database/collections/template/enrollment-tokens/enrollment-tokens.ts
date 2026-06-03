import { createHash, randomBytes } from 'crypto';
import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import type { EnrollmentToken, EnrollmentTokenCreate } from './types';

const COLLECTION = 'enrollment_tokens';

/** Enrollment links are emailed; give the user a generous window to click. */
export const ENROLLMENT_TOKEN_TTL_MS = 60 * 60 * 1000;

let collectionPromise: Promise<Collection<EnrollmentToken>> | null = null;

function getCollection(): Promise<Collection<EnrollmentToken>> {
    if (!collectionPromise) {
        collectionPromise = (async () => {
            const db = await getDb();
            const col = db.collection<EnrollmentToken>(COLLECTION);
            await col.createIndex({ tokenHash: 1 });
            // TTL index reaps spent/expired tokens.
            await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
            return col;
        })().catch((err) => {
            collectionPromise = null;
            throw err;
        });
    }
    return collectionPromise;
}

function toObjectId(id: ObjectId | string): ObjectId | null {
    if (id instanceof ObjectId) return id;
    if (!ObjectId.isValid(id)) return null;
    return new ObjectId(id);
}

function hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Create an enrollment token for a user. Returns the raw token (to embed in
 * the emailed link) and the persisted document. The raw token is never stored.
 */
export async function createEnrollmentToken(
    userId: ObjectId | string
): Promise<{ rawToken: string; token: EnrollmentToken }> {
    const collection = await getCollection();
    const userObjectId = toObjectId(userId);
    if (!userObjectId) {
        throw new Error('Invalid user ID for enrollment token');
    }

    const rawToken = randomBytes(32).toString('hex');
    const now = new Date();
    const document: EnrollmentTokenCreate = {
        userId: userObjectId,
        tokenHash: hashToken(rawToken),
        createdAt: now,
        expiresAt: new Date(now.getTime() + ENROLLMENT_TOKEN_TTL_MS),
    };

    const result = await collection.insertOne(document as EnrollmentToken);
    if (!result.insertedId) {
        throw new Error('Failed to create enrollment token');
    }
    return { rawToken, token: { ...document, _id: result.insertedId } };
}

export async function findValidEnrollmentToken(
    rawToken: string
): Promise<EnrollmentToken | null> {
    const collection = await getCollection();
    const now = new Date();
    return collection.findOne({
        tokenHash: hashToken(rawToken),
        consumedAt: { $exists: false },
        expiresAt: { $gt: now },
    });
}

/**
 * Atomically consume an enrollment token. Returns the document if the caller
 * won the race, else null.
 */
export async function consumeEnrollmentToken(
    tokenId: ObjectId | string
): Promise<EnrollmentToken | null> {
    const collection = await getCollection();
    const objectId = toObjectId(tokenId);
    if (!objectId) return null;

    const now = new Date();
    const result = await collection.findOneAndUpdate(
        {
            _id: objectId,
            consumedAt: { $exists: false },
            expiresAt: { $gt: now },
        },
        { $set: { consumedAt: now } },
        { returnDocument: 'after' }
    );
    return result || null;
}

/** Invalidate any outstanding enrollment tokens for a user. Best-effort. */
export async function invalidateAllEnrollmentTokensForUser(
    userId: ObjectId | string
): Promise<void> {
    const collection = await getCollection();
    const userObjectId = toObjectId(userId);
    if (!userObjectId) return;
    await collection.updateMany(
        { userId: userObjectId, consumedAt: { $exists: false } },
        { $set: { consumedAt: new Date() } }
    );
}
