import { AsyncLocalStorage } from 'async_hooks';
import { findActiveConnectionForUserByToken } from '@/server/database/collections/template/rpc-connections/rpc-connections';
import { RPC_CONNECTION_ENABLED } from './config';
import { RpcConnectionRequiredError } from './errors';

export interface RpcCallContext {
  userId?: string;
  /** Per-connection bearer token (X-RPC-Connection-Token header). */
  clientToken?: string;
  /** Set by system callers (agents, scripts, daemon) that legitimately run outside an HTTP request and shouldn't be gated. */
  bypass?: boolean;
}

const storage = new AsyncLocalStorage<RpcCallContext>();

export function runWithRpcCallContext<T>(
  context: RpcCallContext,
  fn: () => Promise<T>
): Promise<T> {
  return storage.run(context, fn);
}

export function getRpcCallContext(): RpcCallContext | undefined {
  return storage.getStore();
}

export async function assertRpcConnection(): Promise<void> {
  if (!RPC_CONNECTION_ENABLED) return;

  const ctx = storage.getStore();
  // No context → system caller (background job, script, daemon). Can't gate without a user.
  if (!ctx || ctx.bypass) return;

  if (!ctx.userId) {
    throw new RpcConnectionRequiredError(
      'RPC connection required: no authenticated user in request context.'
    );
  }

  if (!ctx.clientToken) {
    throw new RpcConnectionRequiredError(
      'RPC connection required: no connection token in request.'
    );
  }

  const active = await findActiveConnectionForUserByToken(ctx.userId, ctx.clientToken);
  if (!active) throw new RpcConnectionRequiredError();

  if (active.status === 'pending') {
    throw new RpcConnectionRequiredError('RPC connection pending admin approval.');
  }

  const now = Date.now();
  if (!active.expiresAt || active.expiresAt.getTime() <= now) {
    throw new RpcConnectionRequiredError('RPC connection expired. Reconnect to continue.');
  }
}
