---
name: setup-agent-tasks
description: Set up agent tasks for a child project using task-cli. Use this when configuring scheduled workflow agents for a new project.
---
# Setup Agent Tasks for a Child Project

The `agent-tasks/` folder is **not synced** from the template. Each child project needs its own task-cli configuration.

There are two types of agent tasks:
1. **Workflow Agents (`all/`)** — Runs all GitHub workflow agents every 10 min on agents-copy
2. **Code Reviewer (`repo-commits-code-reviewer/`)** — Reviews commits every 4h on main project

---

## Task 1: Workflow Agents (all/)

### 1. Create the folder structure

```bash
mkdir -p agent-tasks/all/runs
```

### 2. Create `agent-tasks/all/config.json`

Replace `<repo-name>` with the project's repository name (e.g., `my-app`, `book-reader`):

```json
{
  "name": "Agent(<repo-name>): All",
  "uniqueKey": "<repo-name>:agent:all",
  "groupName": "<repo-name>",
  "description": "Runs all workflow agents sequentially every 10 minutes",
  "script": {
    "path": "github-workflows-agent",
    "args": ["--all", "--global-limit", "--stream", "--reset"],
    "interpreter": "npm",
    "workingDirectory": "/Users/gileck/Projects/agents-copy/<repo-name>"
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
    "logFile": "/Users/gileck/Projects/<repo-name>/agent-tasks/all/runs/output.log",
    "statusFile": "/Users/gileck/Projects/<repo-name>/agent-tasks/all/runs/status.json"
  }
}
```

### 3. Register the task

```bash
task-cli create --config=./agent-tasks/all/config.json
```

### 4. Verify

```bash
task-cli get <repo-name>:agent:all
```

### Key configuration points

- **`groupName`** — Use the repo name to group all agents for this project together in task-cli.
- **`script.workingDirectory`** — Must point to the project's agents copy (e.g., `/Users/gileck/Projects/agents-copy/<repo-name>`). Create it with `yarn init-agents-copy` if it doesn't exist.
- **`output.logFile` / `output.statusFile`** — Must point to the project's own `agent-tasks/all/runs/` folder, not the template's.
- **`uniqueKey`** — Use `<repo-name>:agent:all` to avoid conflicts with other projects.
- **`name`** — Use `Agent(<repo-name>): All` to identify the project in `task-cli get` output.

### What `--all --global-limit` does

- `--all` runs agents in order: auto-advance, product-dev, product-design, bug-investigator, tech-design, implement, pr-review
- `--global-limit` stops after the first agent that processes items; remaining agents run in the next 10-minute cycle
- This creates natural review gaps (e.g., PR reviewer runs in a later cycle than the implementor)

---

## Task 2: Repo Commits Code Reviewer

This standalone agent reviews git commits for bugs and improvements, creating issues via `yarn agent-workflow create` for admin approval.

### 1. Create the folder structure

```bash
mkdir -p agent-tasks/repo-commits-code-reviewer/runs
```

### 2. Create `agent-tasks/repo-commits-code-reviewer/config.json`

Replace `<repo-name>` with the project's repository name:

```json
{
  "name": "Agent(<repo-name>): Repo Commits Code Reviewer",
  "uniqueKey": "<repo-name>:agent:repo-commits-code-reviewer",
  "groupName": "<repo-name>",
  "description": "Reviews recent commits for bugs and improvements (diff-budget batched, every 4h)",
  "script": {
    "path": "agent:code-reviewer",
    "args": ["--stream"],
    "interpreter": "npm",
    "workingDirectory": "/Users/gileck/Projects/<repo-name>"
  },
  "schedule": {
    "type": "interval",
    "value": "14400000"
  },
  "retry": {
    "enabled": true,
    "maxAttempts": 2,
    "backoffType": "exponential",
    "initialDelayMs": 30000,
    "maxDelayMs": 120000
  },
  "timeout": { "ms": 600000 },
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
    "logFile": "/Users/gileck/Projects/<repo-name>/agent-tasks/repo-commits-code-reviewer/runs/output.log",
    "statusFile": "/Users/gileck/Projects/<repo-name>/agent-tasks/repo-commits-code-reviewer/runs/status.json"
  }
}
```

### 3. Register the task

```bash
task-cli create --config=./agent-tasks/repo-commits-code-reviewer/config.json
```

### 4. Verify

```bash
task-cli get <repo-name>:agent:repo-commits-code-reviewer
```

### Key differences from workflow agents

| Aspect | Workflow Agents (`all/`) | Code Reviewer |
|--------|--------------------------|---------------|
| Schedule | Every 10 min | Every 4 hours |
| Working directory | `agents-copy/<repo>` | Main project |
| Timeout | 15 min | 10 min |
| Retries | 3 | 2 |
| Purpose | Process GitHub workflow | Review commits for bugs |

### How it works

- Uses diff-budget batching (~1500 lines per run)
- Walks commits chronologically from last reviewed commit
- Creates issues via `yarn agent-workflow create` (not auto-approved)
- Admin reviews findings via Telegram approval flow
- State tracked in `agent-tasks/repo-commits-code-reviewer/state.json`

---

## Managing tasks

```bash
# Check status (shows last run, next run, enabled)
task-cli get <repo-name>:agent:all
task-cli get <repo-name>:agent:repo-commits-code-reviewer

# Run manually
task-cli run <repo-name>:agent:all --wait
task-cli run <repo-name>:agent:repo-commits-code-reviewer --wait

# Edit (after updating config.json)
task-cli edit <repo-name>:agent:all --config=./agent-tasks/all/config.json

# Delete
task-cli delete <repo-name>:agent:all --force
```

## Full documentation

- [Workflow agents](docs/template/github-agents-workflow/running-agents.md)
- [Code reviewer](docs/template/standalone-agents/repo-commits-code-reviewer.md)
