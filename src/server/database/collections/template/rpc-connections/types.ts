import type { ObjectId } from 'mongodb';

export type RpcConnectionStatus =
  | 'pending'
  | 'approved'
  | 'revoked'
  | 'expired';

export type RpcConnectionEndedReason =
  | 'ttl'
  | 'user_stop'
  | 'admin_reject'
  | 'pending_timeout';

export interface RpcConnection {
  _id: ObjectId;
  userId: string;
  /**
   * Per-connection bearer token. Generated at insert, returned to the client
   * once via the connect response, and required on every gated RPC call.
   * Lets a stolen cookie alone not impersonate an approved session.
   */
  clientToken: string;
  status: RpcConnectionStatus;
  requestedAt: Date;
  approvedAt?: Date;
  expiresAt?: Date;
  pendingExpiresAt: Date;
  /** Set when the row transitions to revoked or expired. */
  endedAt?: Date;
  userAgent: string;
  ip: string;
  endedReason?: RpcConnectionEndedReason;
}

export interface CreateRpcConnectionParams {
  userId: string;
  userAgent: string;
  ip: string;
  pendingTtlMs: number;
}
