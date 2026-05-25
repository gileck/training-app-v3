import { createHash, randomBytes } from 'crypto';
import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import type { PasswordResetToken, PasswordResetTokenCreate } from './types';

export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

const getCollection = async (): Promise<Collection<PasswordResetToken>> => {
  const db = await getDb();
  return db.collection<PasswordResetToken>('password_reset_tokens');
};

function toObjectId(id: ObjectId | string): ObjectId | null {
  if (id instanceof ObjectId) return id;
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate a fresh reset token for a user.
 * Returns the raw token (to send to the user) AND the persisted document.
 * The raw token is never stored — only its SHA-256 hash is.
 */
export const createPasswordResetToken = async (
  userId: ObjectId | string
): Promise<{ rawToken: string; token: PasswordResetToken }> => {
  const collection = await getCollection();
  const userObjectId = toObjectId(userId);
  if (!userObjectId) {
    throw new Error('Invalid user ID for password reset token');
  }

  const rawToken = randomBytes(32).toString('hex');
  const now = new Date();

  const document: PasswordResetTokenCreate = {
    userId: userObjectId,
    tokenHash: hashToken(rawToken),
    createdAt: now,
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS),
  };

  const result = await collection.insertOne(document as PasswordResetToken);
  if (!result.insertedId) {
    throw new Error('Failed to create password reset token');
  }

  return {
    rawToken,
    token: { ...document, _id: result.insertedId },
  };
};

/**
 * Find a valid (unconsumed, unexpired) token by its raw value.
 * Hashes the input before lookup; raw token is never compared in the DB.
 */
export const findValidPasswordResetToken = async (
  rawToken: string
): Promise<PasswordResetToken | null> => {
  const collection = await getCollection();
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  return collection.findOne({
    tokenHash,
    consumedAt: { $exists: false },
    expiresAt: { $gt: now },
  });
};

/**
 * Atomically mark a token consumed. Returns the consumed document if the
 * caller "won" the race, or null if it was already consumed/expired.
 */
export const consumePasswordResetToken = async (
  tokenId: ObjectId | string
): Promise<PasswordResetToken | null> => {
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
};

/**
 * Invalidate any outstanding tokens for a user (called after a successful
 * reset to prevent leftover tokens from being used). Best-effort.
 */
export const invalidateAllPasswordResetTokensForUser = async (
  userId: ObjectId | string
): Promise<void> => {
  const collection = await getCollection();
  const userObjectId = toObjectId(userId);
  if (!userObjectId) return;

  const now = new Date();
  await collection.updateMany(
    { userId: userObjectId, consumedAt: { $exists: false } },
    { $set: { consumedAt: now } }
  );
};
