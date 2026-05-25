import type { ObjectId } from 'mongodb';

export type SessionType = 'login' | 'register' | 'auto';

export interface UserSessionDocument {
  _id: ObjectId;
  userId: ObjectId;
  type: SessionType;
  createdAt: Date;
}

export type UserSessionCreate = Omit<UserSessionDocument, '_id'>;

export interface PerUserSessionStats {
  userId: string;
  total: number;
  lastAt?: Date;
}
