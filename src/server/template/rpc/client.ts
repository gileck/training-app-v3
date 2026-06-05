import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { createRpcJob, findRpcJobById, findRecentJob } from './collection';
import type { CallRemoteOptions, RpcResult } from './types';

const DEFAULT_TIMEOUT_MS = 55_000;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_PENDING_PICKUP_TIMEOUT_MS = 30_000;

// Local-dev shortcut: run the handler in-process instead of queuing a job for
// the daemon. Double-guarded — only when RPC_LOCAL_DIRECT=true AND not in
// production — because in production the whole point of RPC is to execute from
// the local machine's IP (the Vercel datacenter IP is blocked upstream), and
// running in-process there would defeat it. Locally the API server IS the local
// machine, so it's equivalent and saves running `yarn daemon` + admin approval.
const LOCAL_DIRECT_ENABLED =
  process.env.NODE_ENV !== 'production' &&
  (process.env.RPC_LOCAL_DIRECT ?? '').toLowerCase() === 'true';

type RpcHandler = (args: Record<string, unknown>) => Promise<unknown>;

// tsx's programmatic loader can double-wrap the default export through CJS/ESM
// interop (mod.default.default), unlike the daemon's native import(). Unwrap up
// to two levels to find the handler function regardless of how it's nested.
function resolveDefaultExport(mod: unknown): RpcHandler | undefined {
  let candidate: unknown = mod;
  for (let depth = 0; depth < 2 && candidate && typeof candidate === 'object'; depth++) {
    const next = (candidate as { default?: unknown }).default;
    if (typeof next === 'function') return next as RpcHandler;
    candidate = next;
  }
  return typeof candidate === 'function' ? (candidate as RpcHandler) : undefined;
}

// Execute the handler in the current process, loading the .ts file via tsx the
// same way the daemon does (daemon.ts). webpackIgnore keeps webpack from pulling
// the handler — and its heavy, node-only deps — into the Next server bundle;
// these are true runtime imports resolved from node_modules / disk.
async function callHandlerDirect<TResult>(
  handlerPath: string,
  args: Record<string, unknown>
): Promise<RpcResult<TResult>> {
  const resolved = resolve(process.cwd(), handlerPath);
  const allowedBase = resolve(process.cwd(), 'src/server/');
  if (!resolved.startsWith(allowedBase)) {
    throw new Error(`RPC handler path must resolve within src/server/, got: "${handlerPath}"`);
  }

  const { tsImport } = (await import(/* webpackIgnore: true */ 'tsx/esm/api')) as {
    tsImport: (specifier: string, parentURL: string) => Promise<unknown>;
  };
  const mod = await tsImport(
    pathToFileURL(resolved).href,
    pathToFileURL(`${process.cwd()}/`).href
  );

  const handler = resolveDefaultExport(mod);
  if (!handler) {
    throw new Error(`Handler at "${handlerPath}" has no default export function`);
  }

  // Note: this path skips the connection gate (which lives inside createRpcJob),
  // so no admin approval is required — intended for local dev only.
  const start = Date.now();
  const data = (await handler(args)) as TResult;
  return { data, durationMs: Date.now() - start };
}

export async function callRemote<TResult>(
  handlerPath: string,
  args: Record<string, unknown>,
  options?: CallRemoteOptions
): Promise<RpcResult<TResult>> {
  if (LOCAL_DIRECT_ENABLED) {
    return callHandlerDirect<TResult>(handlerPath, args);
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const pendingPickupTimeoutMs =
    options?.pendingPickupTimeoutMs ?? DEFAULT_PENDING_PICKUP_TIMEOUT_MS;

  // Connection gate runs inside createRpcJob, so every enqueue (including
  // direct callers that bypass callRemote) is gated at one boundary.

  const resolved = resolve(process.cwd(), handlerPath);
  const allowedBase = resolve(process.cwd(), 'src/server/');
  if (!resolved.startsWith(allowedBase)) {
    throw new Error(`RPC handler path must resolve within src/server/, got: "${handlerPath}"`);
  }

  const secret = process.env.RPC_SECRET;
  if (!secret) {
    throw new Error('RPC_SECRET env var is not set');
  }

  // Reuse a recent job for the same handler+args if one exists
  const existing = options?.skipCache ? null : await findRecentJob(handlerPath, args);
  let jobId = existing?._id;

  if (existing?.status === 'completed') {
    return { data: existing.result as TResult, durationMs: 0 };
  }

  if (!jobId) {
    const now = new Date();
    jobId = await createRpcJob({
      handlerPath,
      args,
      secret,
      status: 'pending',
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
    });
  }

  const start = Date.now();
  let handlerStart: number | null = null;

  while (true) {
    await sleep(pollIntervalMs);

    const job = await findRpcJobById(jobId);
    if (!job) {
      throw new Error(`RPC job ${jobId.toHexString()} disappeared`);
    }

    if (job.status === 'completed') {
      return {
        data: job.result as TResult,
        durationMs: Date.now() - start,
      };
    }

    if (job.status === 'failed') {
      throw new Error(`RPC job failed: ${job.error ?? 'unknown error'}`);
    }

    // Start the timeout clock only once the handler is executing
    if (job.status === 'processing' && !handlerStart) {
      handlerStart = job.startedAt?.getTime() ?? Date.now();
    }

    if (handlerStart && Date.now() - handlerStart >= timeoutMs) {
      throw new Error(`RPC call to "${handlerPath}" timed out after ${timeoutMs}ms (handler execution time)`);
    }

    if (
      job.status === 'pending' &&
      Date.now() - start >= pendingPickupTimeoutMs
    ) {
      throw new Error(
        `No RPC daemon picked up the job within ${pendingPickupTimeoutMs}ms — is \`yarn daemon\` running?`
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
