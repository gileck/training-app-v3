import '@/agents/shared/loadEnv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { ensureRpcIndexes, claimNextPendingJob, completeRpcJob, failRpcJob } from './collection';
import { closeDbConnection } from '@/server/database/connection';
import { appConfig } from '@/app.config';

const POLL_INTERVAL_MS = 2_000;
const DEFAULT_MAX_CONCURRENT = 20;
const verbose = process.argv.includes('--verbose');

function parseMaxConcurrent(): number {
  const idx = process.argv.indexOf('--max-concurrent');
  if (idx !== -1 && process.argv[idx + 1]) {
    const val = parseInt(process.argv[idx + 1], 10);
    if (val > 0) return val;
  }
  return DEFAULT_MAX_CONCURRENT;
}

const MAX_CONCURRENT = parseMaxConcurrent();

let running = true;
let activeJobs = 0;

function log(msg: string): void {
  console.log(`[rpc-daemon] ${msg}`);
}

function vlog(msg: string): void {
  if (verbose) console.log(`[rpc-daemon] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function processJob(job: NonNullable<Awaited<ReturnType<typeof claimNextPendingJob>>>): Promise<void> {
  const { handlerPath, secret } = job;
  const jobId = job._id.toHexString();
  const handlerName = handlerPath.split('/').pop() ?? handlerPath;
  log(`Claimed ${jobId} [${handlerName}] (${activeJobs}/${MAX_CONCURRENT} running)`);
  const argsStr = JSON.stringify(job.args);
  vlog(`  args: ${argsStr.length > 100 ? argsStr.slice(0, 100) + '…' : argsStr}`);
  vlog(`  created: ${job.createdAt.toISOString()}`);
  vlog(`  expires: ${job.expiresAt.toISOString()}`);

  const expectedSecret = process.env.RPC_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    await failRpcJob(job._id, 'Invalid or missing RPC secret');
    console.error(`[rpc-daemon] Rejected job ${jobId}: bad secret`);
    return;
  }
  vlog(`  secret: valid`);

  const fullPath = resolve(process.cwd(), handlerPath);
  const allowedBase = resolve(process.cwd(), 'src/server/');
  if (!fullPath.startsWith(allowedBase)) {
    await failRpcJob(job._id, `Invalid handler path: "${handlerPath}"`);
    console.error(`[rpc-daemon] Rejected invalid path: ${handlerPath}`);
    return;
  }
  vlog(`  path check: within src/server/`);

  const fileExists =
    existsSync(fullPath + '.ts') ||
    existsSync(fullPath + '.js') ||
    existsSync(fullPath + '/index.ts') ||
    existsSync(fullPath + '/index.js');
  if (!fileExists) {
    await failRpcJob(job._id, `Handler file not found: "${handlerPath}"`);
    console.error(`[rpc-daemon] Rejected missing file: ${handlerPath}`);
    return;
  }
  vlog(`  file check: exists on disk`);

  const start = Date.now();
  try {
    vlog(`  importing ${fullPath}...`);
    const mod = await import(fullPath);
    const handler = mod.default;

    if (typeof handler !== 'function') {
      throw new Error(`Handler at "${handlerPath}" has no default export function`);
    }

    vlog(`  executing handler...`);
    const result = await handler(job.args);
    const durationMs = Date.now() - start;

    await completeRpcJob(job._id, result);
    log(`Completed ${jobId} [${handlerName}] in ${(durationMs / 1000).toFixed(1)}s (${activeJobs - 1}/${MAX_CONCURRENT} still running)`);
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    await failRpcJob(job._id, errorMsg);
    console.error(`[rpc-daemon] Failed ${jobId} [${handlerName}] after ${(durationMs / 1000).toFixed(1)}s: ${errorMsg} (${activeJobs - 1}/${MAX_CONCURRENT} still running)`);
  }
}

async function pollLoop(): Promise<void> {
  log('=== RPC Daemon Starting ===');
  log(`Database: ${appConfig.dbName}`);
  log(`Max concurrent: ${MAX_CONCURRENT}`);
  log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  vlog(`RPC_SECRET: ${process.env.RPC_SECRET ? 'set' : 'NOT SET'}`);
  vlog(`Working directory: ${process.cwd()}`);
  vlog(`Verbose: on`);

  await ensureRpcIndexes();
  log('Indexes ensured — polling for jobs...');

  let waitingSince: number | null = null;

  while (running) {
    if (activeJobs >= MAX_CONCURRENT) {
      if (!waitingSince) {
        waitingSince = Date.now();
        log(`At capacity (${activeJobs}/${MAX_CONCURRENT}) — waiting for a slot...`);
      }
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (waitingSince) {
      const waitedMs = Date.now() - waitingSince;
      log(`Slot freed after ${(waitedMs / 1000).toFixed(1)}s wait (${activeJobs}/${MAX_CONCURRENT} running)`);
      waitingSince = null;
    }

    try {
      const job = await claimNextPendingJob();
      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      activeJobs++;
      processJob(job)
        .finally(() => { activeJobs--; });
    } catch (err) {
      console.error('[rpc-daemon] Poll error:', err instanceof Error ? err.message : err);
      await sleep(POLL_INTERVAL_MS);
    }
  }

  while (activeJobs > 0) {
    vlog(`Waiting for ${activeJobs} active job(s) to finish...`);
    await sleep(1_000);
  }

  log('Stopped');
}

function handleShutdown(signal: string): void {
  log(`Received ${signal}, shutting down...`);
  running = false;
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

pollLoop()
  .then(() => closeDbConnection())
  .catch((err) => {
    console.error('[rpc-daemon] Fatal error:', err);
    closeDbConnection().finally(() => process.exit(1));
  });
