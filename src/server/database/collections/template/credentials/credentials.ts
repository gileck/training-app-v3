import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import type { WebAuthnCredential, WebAuthnCredentialCreate } from './types';

const COLLECTION = 'credentials';
let collectionPromise: Promise<Collection<WebAuthnCredential>> | null = null;

function getCollection(): Promise<Collection<WebAuthnCredential>> {
    if (!collectionPromise) {
        collectionPromise = (async () => {
            const db = await getDb();
            const col = db.collection<WebAuthnCredential>(COLLECTION);
            // credentialId is the lookup key on every assertion — unique.
            await col.createIndex({ credentialId: 1 }, { unique: true });
            await col.createIndex({ userId: 1 });
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

export type InsertCredentialInput = Omit<WebAuthnCredentialCreate, 'userId'> & {
    userId: ObjectId | string;
};

export async function insertCredential(
    input: InsertCredentialInput
): Promise<WebAuthnCredential> {
    const collection = await getCollection();
    const userObjectId = toObjectId(input.userId);
    if (!userObjectId) {
        throw new Error('Invalid user ID for WebAuthn credential');
    }
    const credential: WebAuthnCredentialCreate = { ...input, userId: userObjectId };
    const result = await collection.insertOne(credential as WebAuthnCredential);
    if (!result.insertedId) {
        throw new Error('Failed to insert WebAuthn credential');
    }
    return { ...credential, _id: result.insertedId };
}

/** Look up a credential by its authenticator-provided id (assertion path). */
export async function findCredentialById(
    credentialId: string
): Promise<WebAuthnCredential | null> {
    const collection = await getCollection();
    return collection.findOne({ credentialId });
}

/** All credentials for a user (device-management list). */
export async function findCredentialsByUserId(
    userId: ObjectId | string
): Promise<WebAuthnCredential[]> {
    const collection = await getCollection();
    const userObjectId = toObjectId(userId);
    if (!userObjectId) return [];
    return collection.find({ userId: userObjectId }).sort({ createdAt: -1 }).toArray();
}

export async function countCredentialsForUser(
    userId: ObjectId | string
): Promise<number> {
    const collection = await getCollection();
    const userObjectId = toObjectId(userId);
    if (!userObjectId) return 0;
    return collection.countDocuments({ userId: userObjectId });
}

/** Map of userId → passkey count, in one aggregate (avoids N+1 in admin list). */
export async function countCredentialsByUser(): Promise<Record<string, number>> {
    const collection = await getCollection();
    const rows = await collection
        .aggregate<{ _id: ObjectId; count: number }>([
            { $group: { _id: '$userId', count: { $sum: 1 } } },
        ])
        .toArray();
    const counts: Record<string, number> = {};
    for (const row of rows) {
        counts[row._id.toString()] = row.count;
    }
    return counts;
}

/** Persist the post-assertion counter + lastUsedAt after a successful login. */
export async function updateCredentialCounter(
    credentialId: string,
    counter: number
): Promise<void> {
    const collection = await getCollection();
    await collection.updateOne(
        { credentialId },
        { $set: { counter, lastUsedAt: new Date() } }
    );
}

export async function renameCredential(
    credentialId: string,
    userId: ObjectId | string,
    deviceName: string
): Promise<boolean> {
    const collection = await getCollection();
    const userObjectId = toObjectId(userId);
    if (!userObjectId) return false;
    const result = await collection.updateOne(
        { credentialId, userId: userObjectId },
        { $set: { deviceName } }
    );
    return result.matchedCount > 0;
}

export async function deleteCredential(
    credentialId: string,
    userId: ObjectId | string
): Promise<boolean> {
    const collection = await getCollection();
    const userObjectId = toObjectId(userId);
    if (!userObjectId) return false;
    const result = await collection.deleteOne({ credentialId, userId: userObjectId });
    return result.deletedCount > 0;
}
