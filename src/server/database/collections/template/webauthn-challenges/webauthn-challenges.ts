import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import type {
    WebAuthnChallenge,
    WebAuthnChallengeCreate,
    WebAuthnChallengePurpose,
} from './types';

const COLLECTION = 'webauthn_challenges';

/** Challenges are valid only for the few seconds a user takes to tap. */
export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

let collectionPromise: Promise<Collection<WebAuthnChallenge>> | null = null;

function getCollection(): Promise<Collection<WebAuthnChallenge>> {
    if (!collectionPromise) {
        collectionPromise = (async () => {
            const db = await getDb();
            const col = db.collection<WebAuthnChallenge>(COLLECTION);
            // TTL index: Mongo reaps documents once expiresAt passes.
            await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
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

/**
 * Persist a freshly generated challenge. Returns the stored document; its
 * `_id` is the `challengeId` the client echoes back on verify.
 */
export async function createWebAuthnChallenge(input: {
    challenge: string;
    purpose: WebAuthnChallengePurpose;
    userId?: ObjectId | string;
}): Promise<WebAuthnChallenge> {
    const collection = await getCollection();
    const now = new Date();
    const userObjectId = input.userId ? toObjectId(input.userId) : null;

    const document: WebAuthnChallengeCreate = {
        challenge: input.challenge,
        purpose: input.purpose,
        ...(userObjectId ? { userId: userObjectId } : {}),
        createdAt: now,
        expiresAt: new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MS),
    };

    const result = await collection.insertOne(document as WebAuthnChallenge);
    if (!result.insertedId) {
        throw new Error('Failed to create WebAuthn challenge');
    }
    return { ...document, _id: result.insertedId };
}

/**
 * Atomically consume a challenge by id. Returns the document if the caller
 * won the race (unconsumed + unexpired), else null.
 */
export async function consumeWebAuthnChallenge(
    challengeId: ObjectId | string,
    purpose: WebAuthnChallengePurpose
): Promise<WebAuthnChallenge | null> {
    const collection = await getCollection();
    const objectId = toObjectId(challengeId);
    if (!objectId) return null;

    const now = new Date();
    const result = await collection.findOneAndUpdate(
        {
            _id: objectId,
            purpose,
            consumedAt: { $exists: false },
            expiresAt: { $gt: now },
        },
        { $set: { consumedAt: now } },
        { returnDocument: 'after' }
    );
    return result || null;
}
