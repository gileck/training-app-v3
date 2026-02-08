---
title: Directory Locking
description: Directory-level lock for preventing concurrent agent runs on same working directory
summary: "Master script acquires per-directory lock using PID-based ownership and stale detection. Prevents concurrent git operations and file modifications."
priority: 3
---

# Directory Locking

The master orchestrator (`src/agents/index.ts`) acquires a directory-level lock before running any agents. This prevents two instances from running simultaneously on the same working directory, which would cause conflicts in git operations, file modifications, and GitHub API calls.

## Lock File Location

```
{tmpdir()}/agent-dir-{sha256(cwd)}.lock
```

Example: `/tmp/agent-dir-a1b2c3d4e5f6...lock`

The SHA-256 hash of the working directory path ensures each directory gets its own lock file without path-separator issues.

## Lock File Format

```json
{
  "pid": 12345,
  "cwd": "/Users/gileck/Projects/agents-copy/app-template-ai",
  "startTime": "2026-02-08T10:30:00.000Z",
  "hostname": "MacBook-Pro.local",
  "agents": ["auto-advance", "product-dev", "product-design", "implement"]
}
```

## Stale Lock Detection

When a lock file already exists, stale detection is checked in this order:

1. **PID dead** — Lock owner process has crashed. Lock is cleared and re-acquired immediately.
2. **Age > staleTimeoutMinutes** — Lock is older than the timeout (default 20 minutes). Even if the PID is alive, the lock is force-cleared with a warning.
3. **PID alive, not stale** — Lock is valid. The new instance prints lock info and exits with code 1.

## CLI Args

| Arg | Default | Description |
|-----|---------|-------------|
| `--stale-timeout <min>` | `20` | Minutes before a lock is considered stale. Set to `0` to force-clear any existing lock. |

## Log Markers

All lock messages use `[LOCK]` prefix for grep-ability:

```
🔒 [LOCK] Acquiring directory lock for /Users/.../app-template-ai...
🔒 [LOCK] Lock acquired (PID: 12345, time: 2026-02-08T10:30:00Z)
⚠️  [LOCK] Lock held by PID 12344 (started 25m ago at 2026-02-08T10:05:00Z)
⚠️  [LOCK] Stale lock (>20m) — force-clearing and acquiring
🔓 [LOCK] Lock released (held for 3m 45s)
```

Search for lock events:
```bash
grep "\[LOCK\]" agent-tasks/all/runs/output-*.log
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| **Two instances started simultaneously** | `writeFileSync({ flag: 'wx' })` (O_EXCL) provides atomic file creation at the OS level. Second instance gets EEXIST error. |
| **Master process crash** | Signal handlers (`SIGINT`, `SIGTERM`, `uncaughtException`, `unhandledRejection`, `exit`) release the lock. If the process is killed with SIGKILL, the next run detects the dead PID and clears the stale lock. |
| **Child process outlives master** | The lock is released when the master exits. Dirty git state from orphaned children is handled by existing `--reset` cleanup. |
| **Lock file deleted by OS or user** | Next instance runs without conflict — equivalent to no lock. |
| **`--stale-timeout 0`** | Forces clearing of any existing lock, regardless of PID status or age. |
| **Hash collision** | SHA-256 collision probability is negligible (~2^-128). |

## Troubleshooting

### Inspect a lock file

```bash
# Find the lock file for a directory
echo -n "/Users/gileck/Projects/agents-copy/app-template-ai" | shasum -a 256
# Then check: /tmp/agent-dir-{hash}.lock
cat /tmp/agent-dir-*.lock | python3 -m json.tool
```

### Manually clear a lock

```bash
rm /tmp/agent-dir-*.lock
```

### Force-clear via CLI

```bash
yarn github-workflows-agent --all --stale-timeout 0 --dry-run
```
