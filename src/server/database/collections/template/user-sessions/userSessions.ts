import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../../../connection';
import {
  PerUserSessionStats,
  UserSessionCreate,
  UserSessionDocument,
} from './types';

const getUserSessionsCollection = async (): Promise<Collection<UserSessionDocument>> => {
  const db = await getDb();
  return db.collection<UserSessionDocument>('user_sessions');
};

export const insertSession = async (session: UserSessionCreate): Promise<void> => {
  const collection = await getUserSessionsCollection();
  await collection.insertOne(session as UserSessionDocument);
};

export const countAllSessions = async (): Promise<number> => {
  const collection = await getUserSessionsCollection();
  return collection.countDocuments({});
};

export const countSessionsSince = async (since: Date): Promise<number> => {
  const collection = await getUserSessionsCollection();
  return collection.countDocuments({ createdAt: { $gte: since } });
};

/**
 * Per-user session totals + last session timestamp.
 * Returns one entry per userId that has any session.
 */
export const getPerUserSessionStats = async (): Promise<PerUserSessionStats[]> => {
  const collection = await getUserSessionsCollection();
  const cursor = collection.aggregate<{
    _id: ObjectId;
    total: number;
    lastAt: Date;
  }>([
    {
      $group: {
        _id: '$userId',
        total: { $sum: 1 },
        lastAt: { $max: '$createdAt' },
      },
    },
  ]);

  const results = await cursor.toArray();
  return results.map((r) => ({
    userId: r._id.toString(),
    total: r.total,
    lastAt: r.lastAt,
  }));
};
