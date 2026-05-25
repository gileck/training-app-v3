import { Collection } from 'mongodb';
import { getDb } from '../../../connection';
import type { RpcDaemonStatus } from './types';

const COLLECTION_NAME = 'rpc_daemon_status';
const SINGLETON_ID = 'singleton' as const;

/** A heartbeat older than this is treated as "daemon offline". */
export const DAEMON_LIVENESS_WINDOW_MS = 30_000;

async function getDaemonStatusCollection(): Promise<Collection<RpcDaemonStatus>> {
  const db = await getDb();
  return db.collection<RpcDaemonStatus>(COLLECTION_NAME);
}

export async function recordDaemonHeartbeat(hostname?: string): Promise<void> {
  const collection = await getDaemonStatusCollection();
  const now = new Date();
  await collection.updateOne(
    { _id: SINGLETON_ID },
    {
      $set: { lastHeartbeat: now, ...(hostname ? { hostname } : {}) },
      $setOnInsert: { _id: SINGLETON_ID, startedAt: now },
    },
    { upsert: true }
  );
}

/**
 * Mark the daemon as starting fresh — overwrites startedAt so the UI can
 * tell when this process took over (useful when the daemon was restarted).
 */
export async function markDaemonStarted(hostname?: string): Promise<void> {
  const collection = await getDaemonStatusCollection();
  const now = new Date();
  await collection.updateOne(
    { _id: SINGLETON_ID },
    { $set: { lastHeartbeat: now, startedAt: now, ...(hostname ? { hostname } : {}) } },
    { upsert: true }
  );
}

export async function getDaemonStatus(): Promise<RpcDaemonStatus | null> {
  const collection = await getDaemonStatusCollection();
  return collection.findOne({ _id: SINGLETON_ID });
}

export async function isDaemonAlive(
  windowMs: number = DAEMON_LIVENESS_WINDOW_MS
): Promise<boolean> {
  const status = await getDaemonStatus();
  if (!status) return false;
  return Date.now() - status.lastHeartbeat.getTime() < windowMs;
}
