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

/** How an approved connection was authorized. Missing = legacy 'telegram'. */
export type RpcConnectionApprovalMethod = 'telegram' | 'passkey';

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
  /** How the session was approved. Missing = legacy 'telegram'. */
  approvalMethod?: RpcConnectionApprovalMethod;
  /** The passkey credential that authorized the session (passkey method only). */
  credentialId?: string;
}

export interface CreateRpcConnectionParams {
  userId: string;
  userAgent: string;
  ip: string;
  pendingTtlMs: number;
}

export interface CreateApprovedRpcConnectionParams {
  userId: string;
  userAgent: string;
  ip: string;
  /** TTL for the already-approved session. */
  ttlMs: number;
  approvalMethod: RpcConnectionApprovalMethod;
  /** The verified passkey credential (passkey method). */
  credentialId?: string;
}
