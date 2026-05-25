---
title: RPC-over-MongoDB Architecture
description: Generic remote function execution system for running server code on a local machine via MongoDB. Use this when working with the RPC daemon or adding new remote handlers.
summary: Vercel inserts jobs into MongoDB, a local daemon polls and executes them, returns results via MongoDB. Used to bypass datacenter IP blocks.
priority: 5
key_points:
  - "`src/server/template/rpc/` - Generic RPC system (zero project-specific code)"
  - "Start daemon: `yarn daemon` or `yarn daemon --verbose` (or `yarn daemon:dev` for tsx --watch + hot handler reload)"
  - "Handlers are modules with a default export async function"
  - "Child-project handlers MUST live under `src/server/project/**` — never under `src/server/template/` (gets overwritten on template sync)"
  - "Security: shared secret (RPC_SECRET env var) + path validation + file existence check"
  - "task-cli config: `agent-tasks/rpc-daemon/config.json`"
---

# RPC-over-MongoDB Architecture

## Problem

Some APIs block requests from Vercel's datacenter IPs (e.g., YouTube transcripts). We need a way to execute functions on a local machine (residential IP) and return results to the Vercel-hosted app.

## Solution

A generic remote function execution system built on MongoDB as a job queue. Fully generic — the `src/server/template/rpc/` folder contains zero project-specific code.

## Flow

```
Vercel (callRemote)         MongoDB (rpc-jobs)         Local Daemon (yarn daemon)
───────────────────         ──────────────────         ──────────────────────────
insert job {                 ──►
  handlerPath,
  args,
  secret,
  status: 'pending'
}
poll every 500ms...                                    poll every 2s
                                                       claim job (pending → processing)
                                                       validate secret
                                                       validate path within src/server/
                                                       validate file exists on disk
                                                       dynamic import(handlerPath)
                                                       run default export(args)
                             ◄──                       update {status: 'completed', result}
read result, return          ◄──
```

## File Structure

```
src/server/template/rpc/
├── types.ts        # RpcJobDocument, RpcJobStatus, CallRemoteOptions, RpcResult<T>
├── collection.ts   # MongoDB operations (inline, not in database/collections/)
├── client.ts       # callRemote<T>() — Vercel-side caller
├── daemon.ts       # Standalone daemon process (yarn daemon)
└── index.ts        # Barrel — exports callRemote and types
```

## Components

### Client (`client.ts`)

`callRemote<TResult>(handlerPath, args, options?)` — called from Vercel server code when you want to wait for the result.

- Validates resolved path is within `src/server/`
- Validates file exists on disk
- Stamps `RPC_SECRET` on the job
- Inserts pending job into MongoDB via `createRpcJob` (which gates via the [connection gate](rpc-connection-gate.md)), or reuses an existing job for the same handler+args
- Polls every 500ms until completed/failed/timeout/no-daemon
- Defaults: 55s handler timeout, 500ms poll, 1hr DB TTL, 30s `pendingPickupTimeoutMs` (fails fast when no daemon claims the job)

For **fire-and-forget** patterns (long-running daemon jobs whose progress is tracked separately), call `createRpcJob` directly from `@/server/template/rpc/collection`. It's gated by the same connection gate, so direct callers don't bypass authorization.

### Daemon (`daemon.ts`)

Standalone process that runs on a local machine. Start with `yarn daemon` or `yarn daemon --verbose`.

- Loads env vars via `src/agents/shared/loadEnv`
- Ensures MongoDB indexes on startup (TTL on `expiresAt`, compound on `{status, createdAt}`)
- Polls every 2s for pending jobs
- For each job, validates in order:
  1. **Secret** — `RPC_SECRET` must match
  2. **Path** — resolved path must be within `src/server/`
  3. **File** — handler file must exist on disk
- Dynamic imports the handler and calls its default export
- Writes result or error back to MongoDB
- Handles SIGINT/SIGTERM for graceful shutdown with MongoDB connection cleanup

### Collection (`collection.ts`)

MongoDB operations for the `rpc-jobs` collection:

- `ensureRpcIndexes()` — TTL index on `expiresAt` (auto-cleanup), compound on `{status, createdAt}`
- `createRpcJob(job)` — insert pending job
- `findRecentJob(handlerPath, args)` — find existing job for deduplication
- `claimNextPendingJob()` — atomic `findOneAndUpdate` (pending → processing), skips expired jobs
- `completeRpcJob(id, result)` — mark completed
- `failRpcJob(id, error)` — mark failed

## Handler Convention

Any handler is a module with a **default export** async function:

```typescript
// src/server/project/rpc-handlers/myRemoteHandler.ts
export default async function(args: Record<string, unknown>): Promise<MyResponse> {
  const param = args.param as string;
  // ... execute locally ...
  return { result };
}
```

### Where to put handlers

| Owner | Path | Notes |
|-------|------|-------|
| **Child projects** | `src/server/project/**` | Put all your custom handlers here |
| Template only | `src/server/template/rpc/handlers/**` | Reserved for handlers shipped with the template |

**Do not add child-project handlers under `src/server/template/`.** That folder is template-owned and gets overwritten on every template sync — your handler will disappear. The path-boundary check only enforces that handlers live somewhere under `src/server/`; ownership is your responsibility.

## Security

Three layers of defense before code execution:

1. **Shared secret** — `RPC_SECRET` env var must be set on both Vercel and local machine. Jobs without a valid secret are rejected.
2. **Path boundary** — Handler path must resolve within `src/server/` after normalization (prevents `../` traversal).
3. **File existence** — Handler file must exist on disk before import.

## Configuration

### Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `RPC_SECRET` | Vercel + local `.env.local` | Shared secret for job authentication |
| `MONGO_URI` | Vercel + local `.env.local` | MongoDB connection (same database) |

### Task Manager

Config: `agent-tasks/rpc-daemon/config.json`

```bash
# Register
task-cli create --config=./agent-tasks/rpc-daemon/config.json

# Start/stop
task-cli run <project>:rpc-daemon
task-cli stop <project>:rpc-daemon
```

## Adding a New Remote Handler

1. Create a module under `src/server/project/` with a default export async function (see [Where to put handlers](#where-to-put-handlers))
2. Call it from Vercel code:
   ```typescript
   import { callRemote } from '@/server/template/rpc';
   const result = await callRemote<MyResponseType>(
     'src/server/project/rpc-handlers/myHandler',
     { arg1: 'value' }
   );
   ```
3. The daemon will automatically pick it up — no registration needed

## Debugging

```bash
# Verbose mode — logs validation steps, args, timing
yarn daemon --verbose

# Check daemon status
task-cli status

# Check for stale/failed jobs in MongoDB
# Jobs auto-expire via TTL index after 1 hour
```

## Related

- **[RPC Connection Gate](rpc-connection-gate.md)** — the authorization layer over this transport. Every `callRemote` from a request-bound caller requires an admin-approved session. The gate is bypassed for system callers (agents, scripts, the daemon itself).
