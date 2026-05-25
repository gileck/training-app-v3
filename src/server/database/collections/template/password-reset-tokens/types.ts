import type { ObjectId } from 'mongodb';

export interface PasswordResetToken {
  _id: ObjectId;
  userId: ObjectId;
  /** SHA-256 hash of the raw token. The raw token is sent to the user
   *  via Telegram and is never stored — only its hash is. */
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  /** Set when the token has been redeemed. Tokens are single-use. */
  consumedAt?: Date;
}

export type PasswordResetTokenCreate = Omit<PasswordResetToken, '_id' | 'consumedAt'>;
