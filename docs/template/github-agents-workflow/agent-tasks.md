# Agent Tasks (task-cli)

This document describes the scheduled agent task managed by `task-cli`, its configuration, and how to use the CLI to manage it.

## Overview

All workflow agents run as a **single task** using `--all --global-limit`, which executes them sequentially on a 10-minute interval via the Task Manager app.

The task config lives in `agent-tasks/all/config.json`, with a `runs/` subfolder for timestamped log and status output files.

All agents run against the **agents copy** (`/Users/gileck/Projects/agents-copy/app-template-ai`) and reset to clean `main` before each run.

## Registered Task

| Task Name | Unique Key | Flags | Schedule |
|-----------|-----------|-------|----------|
| Agent(app-template-ai): All | `app-template:agent:all` | `--all --global-limit` | 10 min |

The `--all` flag runs agents sequentially in order: auto-advance, product-dev, product-design, bug-investigator, tech-design, implement, and pr-review.

The `--global-limit` flag stops the workflow after the first agent that actually processes items. Remaining agents run in the next cycle (10 min later). This creates a natural gap between stages — e.g., after the implementor creates a PR, the PR reviewer won't run until the next cycle, giving the admin and GitHub app time to review first.

### Why a single task with global limit?

- **No folder conflicts** — agents share the same working directory; only one runs at a time
- **Natural review gaps** — `--global-limit` ensures downstream agents (like PR review) don't run immediately after upstream agents (like implement)
- **Simple management** — one task to enable/disable, one status to check
- **No starvation** — idle agents finish in seconds ("No items to process") and don't count toward the global limit

## Folder Structure

```
agent-tasks/
└── all/
    ├── config.json
    └── runs/           # timestamped logs and status files
```

## Task Configuration

```json
{
  "name": "Agent(app-template-ai): All",
  "uniqueKey": "app-template:agent:all",
  "description": "Runs all workflow agents sequentially every 10 minutes",
  "script": {
    "path": "github-workflows-agent",
    "args": ["--all", "--global-limit", "--stream", "--reset"],
    "interpreter": "npm",
    "workingDirectory": "/Users/gileck/Projects/agents-copy/app-template-ai"
  },
  "schedule": {
    "type": "interval",
    "value": "600000"
  },
  "retry": {
    "enabled": true,
    "maxAttempts": 3,
    "backoffType": "exponential",
    "initialDelayMs": 10000,
    "maxDelayMs": 60000
  },
  "timeout": { "ms": 900000 },
  "notifications": {
    "onStart": false,
    "onSuccess": false,
    "onFailure": true
  },
  "options": {
    "enabled": true,
    "allowParallelRuns": false,
    "requiresInternet": true
  },
  "output": {
    "logFile": ".../agent-tasks/all/runs/output.log",
    "statusFile": ".../agent-tasks/all/runs/status.json"
  }
}
```

Key settings:
- **schedule**: 10-minute interval (600000 ms)
- **retry**: 3 attempts with exponential backoff (10s initial, 60s max)
- **timeout**: 15 minutes (900000 ms)
- **notifications**: only on failure
- **allowParallelRuns**: false (prevents overlapping runs)
- **output**: log and status files written to `runs/` with auto-appended timestamps

## Using task-cli

### Check task status

```bash
# List all registered tasks
task-cli get

# Check the agent task (shows enabled, last run, next run)
task-cli get app-template:agent:all

# JSON output
task-cli get app-template:agent:all --json
```

Example output:
```
🔄 [✓] Agent(app-template-ai): All
   ID: 00169d09-...
   Key: app-template:agent:all
   Runs all workflow agents sequentially every 10 minutes
   Last Run: ✅ completed (5m ago)
   Next Run: in 10m
   Schedule: interval (600000)
   Enabled: true
```

### Run manually

```bash
# Run and wait for completion (streams logs)
task-cli run app-template:agent:all --wait
```

### Check running tasks

```bash
task-cli status
```

### Edit the task

Update `agent-tasks/all/config.json`, then apply:
```bash
task-cli edit app-template:agent:all --config=./agent-tasks/all/config.json
```

## Output Files

Each run produces two timestamped files in `agent-tasks/all/runs/`:

- **`output-<timestamp>.log`** — Full stdout/stderr from the agent run
- **`status-<timestamp>.json`** — Run metadata:
  ```json
  {
    "taskId": "00169d09-...",
    "taskName": "Agent(app-template-ai): All",
    "runId": "89246ea7-...",
    "status": "completed",
    "exitCode": 0,
    "startedAt": "2026-02-05T13:38:08.033Z",
    "finishedAt": "2026-02-05T13:38:18.227Z",
    "durationMs": 10194,
    "duration": "10s"
  }
  ```

## Adding Agents for Other Repos

To add agents for a different repo, create a new task following the same pattern:

1. Create `agent-tasks/<repo-name>/config.json` with the repo's `workingDirectory`
2. Use `Agent(<repo-name>): All` naming and `<repo-name>:agent:all` unique key
3. Register with `task-cli create --config=./agent-tasks/<repo-name>/config.json`
