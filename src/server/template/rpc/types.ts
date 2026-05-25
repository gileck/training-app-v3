import type { ObjectId } from 'mongodb';

export type RpcJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface RpcJobDocument {
  _id: ObjectId;
  handlerPath: string;
  args: Record<string, unknown>;
  secret: string;
  status: RpcJobStatus;
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export interface RpcJobCreate {
  handlerPath: string;
  args: Record<string, unknown>;
  secret: string;
  status: RpcJobStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface CallRemoteOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  ttlMs?: number;
  skipCache?: boolean;
  /** Fail with a clear "no daemon" error if the job stays pending this long. Default 30s. */
  pendingPickupTimeoutMs?: number;
}

export interface RpcResult<T> {
  data: T;
  durationMs: number;
}
