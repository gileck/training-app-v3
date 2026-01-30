---
name: vercel-cli-usage
description: when using Vercel CLI tool or managing Vercel deployments
---
# Vercel CLI Usage Guidelines

## Overview

The Vercel CLI tool (`scripts/vercel-cli.ts`) provides a command-line interface for interacting with Vercel deployments and projects using the Vercel REST API.

## Setup

### Prerequisites

1. **VERCEL_TOKEN**: Required environment variable
   - Get your token from: https://vercel.com/account/tokens
   - Add to `.env`: `VERCEL_TOKEN=your_token_here`

2. **Project Linking** (optional but recommended):
   - Run `vercel link` in your project root to create `.vercel/project.json`
   - This enables auto-detection of project ID and org ID

## Commands

### List Deployments

```bash
# List recent deployments
yarn vercel-cli list

# Filter by target
yarn vercel-cli list --target production
yarn vercel-cli list --target preview

# Filter by state
yarn vercel-cli list --state READY
yarn vercel-cli list --state ERROR

# Limit results
yarn vercel-cli list --limit 10
```

### Get Deployment Info

```bash
# By deployment ID
yarn vercel-cli info --deployment dpl_xxxxxxxxxxxx
```

### Get Build Logs

```bash
# Get build logs for a deployment
yarn vercel-cli logs --deployment dpl_xxxxxxxxxxxx

# Limit log lines
yarn vercel-cli logs --deployment dpl_xxxxxxxxxxxx --limit 50
```

**Note**: This retrieves build logs only, not runtime logs. Runtime logs require the Vercel dashboard or Log Drains.

### List Environment Variables

```bash
# List all env vars
yarn vercel-cli env

# Filter by target
yarn vercel-cli env --target production
yarn vercel-cli env --target preview
yarn vercel-cli env --target development
```

### Push Environment Variables to Vercel

```bash
# Push all .env variables to all targets (production, preview, development)
yarn vercel-cli env:push

# Push only to production
yarn vercel-cli env:push --target production

# Push and overwrite existing variables
yarn vercel-cli env:push --overwrite

# Push from a custom file
yarn vercel-cli env:push --file .env.production --target production --overwrite
```

**Options:**
- `--file <path>` - Path to .env file (default: `.env`)
- `--target <targets>` - Comma-separated targets (default: `production,preview,development`)
- `--overwrite` - Update existing variables (default: skip existing)

### Show Project Info

```bash
# Show current project details
yarn vercel-cli project
```

## Global Options

| Option | Description |
|--------|-------------|
| `--project-id <id>` | Override auto-detected project ID |
| `--team-id <id>` | Override auto-detected team/org ID |
| `--cloud-proxy` | Enable Claude Code cloud environment support |

## Cloud Environment (Claude Code Web)

When running in Claude Code cloud environment, use `--cloud-proxy`:

```bash
yarn vercel-cli --cloud-proxy list
yarn vercel-cli --cloud-proxy info --deployment dpl_xxx
```

This enables:
- HTTP proxy support via `HTTPS_PROXY`/`HTTP_PROXY` env vars
- Quote stripping from `VERCEL_TOKEN` (cloud may add literal quotes)

## Common Use Cases

### Check Latest Production Deployment

```bash
yarn vercel-cli list --target production --limit 1
```

### Debug Failed Deployment

```bash
# Find failed deployments
yarn vercel-cli list --state ERROR

# Get details and logs
yarn vercel-cli info --deployment dpl_xxx
yarn vercel-cli logs --deployment dpl_xxx
```

### Verify Environment Variables Before Deploy

```bash
yarn vercel-cli env --target production
```

## Error Handling

Common errors and solutions:

| Error | Solution |
|-------|----------|
| `VERCEL_TOKEN not set` | Add `VERCEL_TOKEN=xxx` to `.env` |
| `forbidden` | Check token permissions at vercel.com/account/tokens |
| `not_found` | Verify deployment/project ID |
| `Could not determine project ID` | Run `vercel link` or use `--project-id` |

## Best Practices

1. **Always use `--cloud-proxy`** when running in Claude Code cloud
2. **Link your project** with `vercel link` for seamless auto-detection
3. **Check build logs first** when deployments fail
4. **Filter by target** when you have many preview deployments
