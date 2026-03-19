---
title: Workflow Review Agent
description: Pipeline agent that reviews completed workflow items and creates improvement issues.
summary: "Runs as the last step in the pipeline (after pr-review). Picks up Done items where reviewed !== true, analyzes their agent execution logs via LLM, appends [LOG:REVIEW] section to the log file, stores summary on the workflow item, sends Telegram notification, and creates improvement issues via agent-workflow create."
priority: 6
key_points:
  - "Part of the pipeline — added to ALL_ORDER after pr-review, runs every cycle via --all"
  - "No local state — review state lives on the workflow item in MongoDB (reviewed, reviewSummary)"
  - "Skips items without local log files (agent-logs/issue-N.md)"
  - "Uses read-only tools (Read, Grep, Glob) to incrementally analyze logs"
  - "Creates workflow items for findings via yarn agent-workflow create (requires admin approval)"
  - "Appends [LOG:REVIEW] section to log file following .ai/commands/workflow-review.md format"
  - "Cross-references task runner logs (agent-tasks/all/runs/) for process-level debugging"
related_docs:
  - overview.md
  - running-agents.md
  - agent-logging.md
---

# Workflow Review Agent

Pipeline agent that reviews completed workflow items, analyzes their execution logs, and creates improvement issues.

## Overview

The workflow review agent is the final step in the pipeline. When items reach Done status, this agent:

1. Queries Done items where `reviewed !== true` from MongoDB
2. Checks that a local log file exists at `agent-logs/issue-{N}.md`
3. Runs an LLM agent to analyze the log file using read-only tools (Read, Grep, Glob)
4. Creates workflow items for any findings via `yarn agent-workflow create --created-by workflow-review`
5. Appends a `[LOG:REVIEW]` section to the log file
6. Updates the workflow item in DB with `reviewed: true` and `reviewSummary`
7. Sends a Telegram notification with the review summary

## Architecture

### Pipeline Position

The agent runs as the last entry in `ALL_ORDER` in `src/agents/index.ts`:

```
auto-advance → product-dev → product-design → bug-investigator → tech-design → implement → pr-review → workflow-review
```

### State Management

- **No local state files** — all review state lives on the workflow item document in MongoDB
- `reviewed: boolean` — set to `true` after successful review
- `reviewSummary: string` — brief assessment from the LLM

### Safety Nets

- Items without local log files are skipped (no LLM call)
- Items with existing `[LOG:REVIEW]` marker in log file are skipped (idempotency)
- Default limit of 1 item per run (configurable via `--limit`), newest items reviewed first

## Usage

```bash
# Run standalone
yarn agent:workflow-review --dry-run --stream

# Run with specific issue
yarn agent:workflow-review --id 43 --stream

# Run as part of full pipeline
yarn github-workflows-agent --all

# Run only workflow review
yarn github-workflows-agent --workflow-review --dry-run
```

### CLI Options

Standard options from `createCLI`:

| Option | Description |
|--------|-------------|
| `--id <id>` | Process specific item by issue number or MongoDB ID prefix |
| `--limit <n>` | Max items to process (default: 1) |
| `--dry-run` | Preview without changes |
| `--stream` | Stream LLM output |
| `--verbose` | Show debug output |
| `--timeout <s>` | Timeout per item in seconds |

## Analysis Methodology

The agent follows the same methodology as `.ai/commands/workflow-review.md`:

### Senior Engineer Mindset
- Find ROOT CAUSES, not surface observations
- Always ask "why?" at least twice
- Cross-reference issue logs with task runner logs
- Every finding must have a root cause

### What Gets Analyzed
- **Errors & failures** — `[LOG:ERROR]`, `[LOG:FATAL]` markers with root cause investigation
- **Efficiency** — Redundant file reads within a single phase (3+ reads)
- **Workflow** — Phase transitions, missing `PHASE_END` markers
- **Cost** — Token usage relative to task complexity
- **Prompts** — Agent confusion indicators

### Task Runner Log Cross-Reference
For any errors or anomalies, the agent also checks task runner logs in `agent-tasks/all/runs/`:
- `status-YYYYMMDD-HHMMSS-mmm.json` — run status, exit codes, timestamps
- `output-YYYYMMDD-HHMMSS-mmm.log` — raw stdout/stderr from agent processes
- Helps diagnose process-level issues (crashes, timeouts, network failures)

### Systemic Improvement Priority
1. Update project docs (`docs/`)
2. Verify pipeline worked (tech design included relevant docs)
3. General prompt principles (universal patterns only)
4. Feature-specific additions (last resort)

## Output

### Structured Output

The agent returns a `WorkflowReviewOutput` with:
- `findings[]` — Each with type, severity, priority, size, complexity, root cause
- `executiveSummary` — Status, cost, duration, assessment
- `systemicImprovements[]` — Doc/rule/prompt/logging improvements

### Log File Section

Appended to `agent-logs/issue-{N}.md`:

```markdown
---

## [LOG:REVIEW] Issue Review

**Reviewed:** [ISO timestamp]
**Reviewer:** workflow-review-agent

### Executive Summary
- **Status**: completed/failed/partial
- **Total Cost**: $X.XX
- **Duration**: Xm Xs
- **Overall Assessment**: Brief assessment

### Findings (N)
- [ ] [severity] title — description

### Systemic Improvements
| Type | Target File | Recommendation |
|------|-------------|----------------|
```

## Files

| File | Purpose |
|------|---------|
| `src/agents/core-agents/workflowReviewAgent/index.ts` | Agent implementation |
| `src/agents/shared/output-schemas.ts` | `WorkflowReviewOutput` schema |
| `src/agents/shared/notifications/` | `notifyWorkflowReviewComplete()` |
| `src/server/database/collections/template/workflow-items/workflow-items.ts` | `setWorkflowReviewData()` |
