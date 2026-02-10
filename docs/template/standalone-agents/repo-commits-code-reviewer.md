---
title: Repo Commits Code Reviewer
description: Standalone agent that reviews git commits for bugs and improvements. Use this to understand the automated code review system.
summary: "Reviews current source code guided by recent commits using diff-budget batching, creates issues via agent-workflow for admin approval. Runs every 4 hours, NOT part of the GitHub Projects workflow pipeline."
priority: 3
key_points:
  - "Diff-budget approach: ~1500 lines per run, walks commits chronologically"
  - "Creates issues via `yarn agent-workflow create` for Telegram approval"
  - "Output includes priority, size (XS/S/M/L), complexity, and risk assessment"
  - "State tracked in agent-tasks/repo-commits-code-reviewer/state.json"
---

# Repo Commits Code Reviewer

Standalone agent that periodically reviews current source code for bugs, security issues, and improvements, guided by recent git commits. Creates issues via `yarn agent-workflow create` for admin approval via Telegram.

**NOT part of the GitHub Projects workflow pipeline** — this is an independent improvement agent.

## Overview

The agent runs every 4 hours, collects commits since its last run using a diff-budget approach, and uses them as **pointers** to areas of recent change. The actual review is performed against the **current source code**, not against commit diffs. This source-based approach eliminates false positives from issues that were already fixed in subsequent commits. Admin sees findings in Telegram with full context (priority, size, complexity, risk) to make quick ROI-based decisions.

### Key Characteristics

| Aspect | Details |
|--------|---------|
| **Schedule** | Every 4 hours (14400000 ms) |
| **Diff Budget** | ~1500 lines per run |
| **State File** | `agent-tasks/repo-commits-code-reviewer/state.json` |
| **Issue Creation** | Via `yarn agent-workflow create` (requires admin approval) |
| **Tools Available** | Read-only: Read, Glob, Grep |

## How It Works

### Diff-Budget Approach

Instead of reviewing all commits or commits from a fixed time window, the agent uses a **diff-budget** approach:

1. Load state (last reviewed commit SHA)
2. Get all commits since last reviewed commit (oldest first)
3. Walk commits chronologically, accumulating diff lines
4. Stop when budget (~1500 lines) is reached
5. Claude uses commit metadata (titles, files changed, diffstat) to identify what changed, then reads and reviews the **current source code** of those files
6. Save state at last reviewed commit (not HEAD)
7. Remaining commits picked up in next run

**Benefits:**
- Consistent review quality regardless of commit frequency
- Large commits don't skip smaller ones
- Busy days simply take more runs to catch up
- Each run is bounded and high-quality

### First Run Seeding

On first run (no state file), the agent seeds from the last 3 days of commits.

```bash
# Override days for first run
yarn agent:code-reviewer --days 7
```

### Commit Filtering

The agent skips:
- Merge commits
- Commits only touching ignored paths:
  - `docs/`
  - `agent-logs/`
  - `agent-tasks/`
  - `.ai/`
  - `task-manager/`

## Review Context

The agent uses commits as pointers to areas of recent change, but all findings are based on the **current source code**. This avoids false positives from issues that were introduced in one commit but fixed in a later one.

Before forming findings, Claude:

1. **Reads project guidelines** — `CLAUDE.md`, relevant docs from `docs/`, skill rules from `.ai/skills/`
2. **Reads full current source files** — The complete current version of every file mentioned in the commits
3. **Reads related code** — Uses Grep/Glob to find callers, usages, consumers
4. **Forms findings against current code** — Each finding must be verifiable in the current source, not in historical diffs

This ensures findings reflect the actual state of the codebase and are based on project conventions, not generic best practices.

## Finding Output Format

Each finding includes:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `bug` \| `improvement` | What kind of issue |
| `severity` | `critical` \| `high` \| `medium` \| `low` | How severe |
| `priority` | `critical` \| `high` \| `medium` \| `low` | For issue creation |
| `size` | `XS` \| `S` \| `M` \| `L` | Fix effort estimate |
| `complexity` | `Low` \| `Medium` \| `High` | Fix complexity |
| `riskLevel` | `High` \| `Medium` \| `Low` | Likelihood of real problems |
| `riskDescription` | string | When/how the risk manifests |
| `title` | string | Actionable title (max 80 chars) |
| `description` | string | What, why, suggested fix |
| `affectedFiles` | string[] | Files with line numbers |
| `relatedCommit` | string | Commit hash that pointed to this area |
| `shouldCreateIssue` | boolean | Whether to create an issue (false = informational only) |

### Size Guidelines

| Size | Lines of Code | Description |
|------|---------------|-------------|
| **XS** | < 10 lines | Trivial fix, few lines |
| **S** | 10-50 lines | Small but requires some work |
| **M** | Moderate | Multiple files or logic changes |
| **L** | Significant | Major refactoring or new functionality |

### Risk Assessment

Risk helps admin make quick ROI decisions:

| Risk Level | Meaning | Example |
|------------|---------|---------|
| **High** | Affects every user or crashes in production | "Crashes on every bot restart" |
| **Medium** | Affects some users or specific conditions | "Fails when user has no avatar" |
| **Low** | Theoretical edge case, unlikely in practice | "Overflow after years of continuous use" |

**Quick ROI heuristics:**
- Low risk + XS fix = probably skip
- High risk + XS fix = definitely approve
- High risk + L fix = prioritize but plan carefully

## Issue Description Format

When an issue is created, the description includes:

```markdown
**Priority:** High | **Size:** XS | **Complexity:** Low | **Risk:** High

> Crashes on every bot restart when session file is missing

## Description
The bot attempts to read session.json without checking if it exists...

## Affected Files
- `src/bot/session.ts:45`
- `src/bot/init.ts:12`

**Related Commit:** abc1234

---
_Detected by repo-commits-code-reviewer agent_
```

## CLI Usage

```bash
# Run with streaming output
yarn agent:code-reviewer --stream

# Dry run (preview findings without creating issues)
yarn agent:code-reviewer --dry-run --stream

# Custom diff budget
yarn agent:code-reviewer --max-diff-lines 2000

# Custom seed days (first run only)
yarn agent:code-reviewer --days 7
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--dry-run` | Preview findings without creating issues | false |
| `--stream` | Stream Claude output | false |
| `--max-diff-lines <n>` | Diff-line budget per run | 1500 |
| `--days <n>` | Seed lookback for first run only | 3 |

## Task Configuration

Registered with task-cli as `app-template:agent:repo-commits-code-reviewer`:

```json
{
  "name": "Agent(app-template-ai): Repo Commits Code Reviewer",
  "uniqueKey": "app-template:agent:repo-commits-code-reviewer",
  "schedule": { "type": "interval", "value": "14400000" },
  "script": {
    "path": "agent:code-reviewer",
    "interpreter": "npm",
    "args": ["--stream"]
  }
}
```

### Check Task Status

```bash
task-cli get app-template:agent:repo-commits-code-reviewer
```

### Run Manually

```bash
task-cli run app-template:agent:repo-commits-code-reviewer --wait
```

## State Management

State is stored in `agent-tasks/repo-commits-code-reviewer/state.json`:

```json
{
  "lastCommitSha": "abc1234...",
  "lastRunAt": "2026-02-05T16:43:55.236Z"
}
```

**Important:** State file is gitignored. Each environment tracks its own state.

### Reset State

To re-review commits, delete the state file:

```bash
rm agent-tasks/repo-commits-code-reviewer/state.json
```

Or manually edit to set a specific commit:

```bash
echo '{"lastCommitSha": "abc1234", "lastRunAt": "2026-02-05T00:00:00Z"}' > agent-tasks/repo-commits-code-reviewer/state.json
```

## What Gets Reviewed

**Focus areas:**
- Bugs: Missing error handling, null/undefined access, race conditions, logic errors
- Security: Injection vulnerabilities, exposed secrets, insecure patterns
- Performance: Unnecessary re-renders, missing memoization, N+1 queries
- Architecture: Patterns that violate project guidelines

**Ignored:**
- Formatting and naming preferences
- Trivial optimizations
- Subjective style choices
- Files in docs/, agent-logs/, .ai/ directories

## Relationship to GitHub Agents Workflow

This agent is **completely separate** from the GitHub Projects workflow:

| Aspect | Repo Commits Code Reviewer | GitHub Agents Workflow |
|--------|---------------------------|------------------------|
| **Purpose** | Find issues in existing code | Implement new features/bugs |
| **Trigger** | Scheduled (every 4h) | Items in GitHub Projects columns |
| **Output** | Creates new issues | Creates PRs for existing issues |
| **Pipeline** | Standalone | 6-column workflow |
| **Issue Creation** | Via `yarn agent-workflow create` | N/A (processes existing issues) |

Issues created by this agent enter the normal workflow — admin approves via Telegram, then they flow through the GitHub Projects pipeline like any other issue.
