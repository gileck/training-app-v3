---
title: Vercel CLI Tool
description: CLI for managing Vercel deployments and env vars. Use this for deployment operations.
summary: "Run `vercel link` first. **CRITICAL: Never use `npx vercel env add` with piped input** - use `yarn vercel-cli env:sync` instead. Commands - `yarn vercel-cli list`, `yarn vercel-cli env:sync`, `yarn vercel-cli logs`."
priority: 4
related_rules:
  - vercel-cli-usage
---

# Vercel CLI Tool

> This is the detailed guide for the Vercel CLI. For a quick reference, see [CLAUDE.md](../CLAUDE.md#vercel-cli-tool).

## Overview

`yarn vercel-cli` provides a CLI for listing deployments, viewing build logs, checking environment variables, and getting project info using the Vercel REST API. Requires `VERCEL_TOKEN` in `.env`.

## Setup

```bash
# Add to .env (get token from https://vercel.com/account/tokens)
VERCEL_TOKEN=your_token_here

# Link project (recommended for auto-detection)
vercel link
```

## Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List deployments | `yarn vercel-cli list --target production` |
| `info` | Get deployment details | `yarn vercel-cli info --deployment dpl_xxx` |
| `logs` | Get build logs | `yarn vercel-cli logs --deployment dpl_xxx` |
| `env` | List environment variables | `yarn vercel-cli env --target production` |
| `env:push` | Push .env to Vercel | `yarn vercel-cli env:push --overwrite` |
| `project` | Show project info | `yarn vercel-cli project` |

## Common Workflows

### Check Latest Production Deployment

```bash
yarn vercel-cli list --target production --limit 1
```

### Debug a Failed Deployment

```bash
yarn vercel-cli list --state ERROR
yarn vercel-cli info --deployment dpl_xxx
yarn vercel-cli logs --deployment dpl_xxx
```

### Verify Environment Variables Before Deploy

```bash
yarn vercel-cli env --target production
```

### Push All .env Variables to Vercel

```bash
# Push to all targets
yarn vercel-cli env:push

# Push only to production, overwriting existing
yarn vercel-cli env:push --target production --overwrite
```

## Key Points

- Auto-detects project from `.vercel/project.json` (or use `--project-id`)
- Auto-detects team from linked project (or use `--team-id`)
- Loads `VERCEL_TOKEN` from `.env` automatically
- Build logs only (runtime logs require Vercel dashboard)

## Cloud Environment (Claude Code Web)

```bash
yarn vercel-cli --cloud-proxy list
yarn vercel-cli --cloud-proxy logs --deployment dpl_xxx
```

Use `--cloud-proxy` when running in Claude Code cloud environment.

## Script Location

`scripts/vercel-cli.ts`

## Related Rules

[.ai/skills/vercel-cli-usage/SKILL.md](../.ai/skills/vercel-cli-usage/SKILL.md)

---

*Back to [CLAUDE.md](../CLAUDE.md)*
