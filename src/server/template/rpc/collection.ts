import type { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/database/connection';
import { assertRpcConnection } from './connection-gate';
import type { RpcJobDocument, RpcJobCreate } from './types';

const COLLECTION_NAME = 'rpc-jobs';

async function getCollection(): Promise<Collection<RpcJobDocument>> {
  const db = await getDb();
  return db.collection<RpcJobDocument>(COLLECTION_NAME);
}

export async function ensureRpcIndexes(): Promise<void> {
  const col = await getCollection();
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await col.createIndex({ status: 1, createdAt: 1 });
}

export async function createRpcJob(job: RpcJobCreate): Promise<ObjectId> {
  // Gate here (not just in callRemote) so direct callers — fire-and-forget
  // patterns that don't wait for a result — are also gated.
  await assertRpcConnection();
  const col = await getCollection();
  const result = await col.insertOne(job as unknown as RpcJobDocument);
  return result.insertedId;
}

export async function findRpcJobById(id: ObjectId): Promise<RpcJobDocument | null> {
  const col = await getCollection();
  return col.findOne({ _id: id });
}

export async function claimNextPendingJob(): Promise<RpcJobDocument | null> {
  const col = await getCollection();
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
  return col.findOneAndUpdate(
    {
      expiresAt: { $gt: new Date() },
      $or: [
        { status: 'pending' },
        { status: 'processing', startedAt: { $lt: staleThreshold } },
      ],
    },
    { $set: { status: 'processing', startedAt: new Date() } },
    { sort: { createdAt: 1 }, returnDocument: 'after' }
  );
}

export async function findRecentJob(
  handlerPath: string,
  args: Record<string, unknown>
): Promise<RpcJobDocument | null> {
  const col = await getCollection();
  return col.findOne(
    {
      handlerPath,
      args,
      status: { $in: ['pending', 'processing', 'completed'] as const },
      expiresAt: { $gt: new Date() },
    },
    { sort: { createdAt: -1 } }
  );
}

/**
 * Find the most-recent rpc-job for a given assistant-message id —
 * agent jobs put the assistant-message id under `args.sourceMessageId`,
 * so this is the canonical "what happened to my turn?" lookup. Returns
 * null when the job has TTL'd out (1h default).
 */
export async function findRpcJobBySourceMessageId(
  sourceMessageId: string
): Promise<RpcJobDocument | null> {
  const col = await getCollection();
  return col.findOne(
    { 'args.sourceMessageId': sourceMessageId },
    { sort: { createdAt: -1 } }
  );
}

export async function completeRpcJob(id: ObjectId, result: unknown): Promise<void> {
  const col = await getCollection();
  await col.updateOne(
    { _id: id },
    { $set: { status: 'completed', result, completedAt: new Date() } }
  );
}

export async function failRpcJob(id: ObjectId, error: string): Promise<void> {
  const col = await getCollection();
  await col.updateOne(
    { _id: id },
    { $set: { status: 'failed', error, completedAt: new Date() } }
  );
}
