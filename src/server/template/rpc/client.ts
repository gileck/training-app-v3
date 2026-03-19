import { resolve } from 'path';
import { createRpcJob, findRpcJobById, findRecentJob } from './collection';
import type { CallRemoteOptions, RpcResult } from './types';

const DEFAULT_TIMEOUT_MS = 55_000;
const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function callRemote<TResult>(
  handlerPath: string,
  args: Record<string, unknown>,
  options?: CallRemoteOptions
): Promise<RpcResult<TResult>> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

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
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
