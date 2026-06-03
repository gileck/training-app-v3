import type {
  RpcConnectionEndedReason,
  RpcConnectionStatus,
} from '@/server/database/collections/template/rpc-connections/types';
import type {
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser';

export interface RpcConnectionView {
  id: string;
  userId: string;
  status: RpcConnectionStatus;
  /** ISO date */
  requestedAt: string;
  /** ISO date — approved sessions only */
  approvedAt?: string;
  /** ISO date — approved sessions: TTL expiry */
  expiresAt?: string;
  /** ISO date — pending sessions: admin-response deadline */
  pendingExpiresAt: string;
  /** ISO date — set when status transitions to revoked or expired */
  endedAt?: string;
  userAgent: string;
  ip: string;
  /** Resolved at list time from the users collection; falls back to userId if not found. */
  requestedByUsername?: string;
  endedReason?: RpcConnectionEndedReason;
}

export type ConnectRequest = Record<string, never>;

export interface ConnectResponse {
  connection?: RpcConnectionView;
  /** Per-connection bearer token. Returned only on connect; the client must persist it. */
  clientToken?: string;
  error?: string;
}

/**
 * Passkey device-auth connect (passkey mode): a two-step ceremony that
 * replaces the Telegram admin approval. `connect-options` issues an
 * authentication assertion restricted to the user's registered passkeys;
 * `connect-verify` validates it and returns an already-approved connection.
 */
export type ConnectOptionsRequest = Record<string, never>;

export interface ConnectOptionsResponse {
  options?: PublicKeyCredentialRequestOptionsJSON;
  challengeId?: string;
  error?: string;
}

export interface ConnectVerifyRequest {
  challengeId: string;
  response: AuthenticationResponseJSON;
}

/** Same shape as ConnectResponse — returns the approved connection + token. */
export type ConnectVerifyResponse = ConnectResponse;

export type GetCurrentRequest = Record<string, never>;

export interface GetCurrentResponse {
  connection: RpcConnectionView | null;
}

export type StopRequest = Record<string, never>;

export interface StopResponse {
  success: boolean;
}

export interface TestRpcRequest {
  message?: string;
}

export interface TestRpcResponse {
  ok: boolean;
  echo?: string;
  handlerTimestamp?: string;
  handlerHost?: string | null;
  durationMs?: number;
  error?: string;
}

export interface ListHistoryRequest {
  limit?: number;
}

export interface ListHistoryResponse {
  connections: RpcConnectionView[];
}

export type DaemonStatusRequest = Record<string, never>;

export interface DaemonStatusResponse {
  alive: boolean;
  /** ISO date — last time the daemon wrote a heartbeat. null if never. */
  lastHeartbeat: string | null;
  /** ISO date — when this daemon process started. null if never. */
  startedAt: string | null;
  /** Hostname the daemon is running on, if reported. */
  hostname?: string;
  /** Milliseconds since the last heartbeat. null if never. */
  ageMs: number | null;
}
