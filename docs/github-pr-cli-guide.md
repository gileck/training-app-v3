# GitHub PR CLI Tool

> This is the detailed guide for the GitHub PR CLI. For a quick reference, see [CLAUDE.md](../CLAUDE.md#github-pr-cli-tool).

## Overview

`yarn github-pr` provides a CLI for creating, updating, and merging PRs using the GitHub API via `@octokit/rest`. Requires `GITHUB_TOKEN` in `.env`.

## Setup

```bash
# Add to .env (Fine-grained token with repo permissions, or Classic token with `repo` scope)
GITHUB_TOKEN=github_pat_xxxxx...
```

## Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `create` | Create a new PR | `yarn github-pr create --title "feat: feature" --body "Description"` |
| `list` | List PRs | `yarn github-pr list --state open` |
| `info` | Get PR details | `yarn github-pr info --pr 1` |
| `comment` | Add comment | `yarn github-pr comment --pr 1 --message "LGTM!"` |
| `title` | Update title | `yarn github-pr title --pr 1 --text "feat: new feature"` |
| `body` | Update description | `yarn github-pr body --pr 1 --text "Description here"` |
| `label` | Add/remove labels | `yarn github-pr label --pr 1 --add bug,urgent` |
| `reviewer` | Request reviewers | `yarn github-pr reviewer --pr 1 --users alice,bob` |
| `merge` | Merge PR | `yarn github-pr merge --pr 1 --method squash` |
| `close` | Close PR | `yarn github-pr close --pr 1` |

## Common Workflows

### Create a PR

```bash
git checkout -b feat/my-feature
# ... make changes, commit ...
git push -u origin feat/my-feature
yarn github-pr create --title "feat: my feature" --body "Description"

# Or create as draft:
yarn github-pr create --title "feat: my feature" --body "WIP" --draft
```

### Update PR Title and Description

```bash
yarn github-pr title --pr 1 --text "feat: improved title"
yarn github-pr body --pr 1 --text "## Summary\nDetailed description..."
```

### Add a Comment

```bash
yarn github-pr comment --pr 1 --message "Ready for review!"
```

### Squash and Merge with Custom Commit Message

```bash
yarn github-pr merge --pr 1 --method squash \
  --title "feat: my feature" \
  --message "Detailed commit description"
```

## Key Points

- Auto-detects `owner/repo` from git remote (or use `--owner`/`--repo`)
- Auto-detects current branch for PR creation (or use `--head`)
- Auto-detects default branch for PR base (or use `--base`)
- Loads `GITHUB_TOKEN` from `.env` automatically
- Merge methods: `merge`, `squash`, `rebase` (default: `squash`)

## Cloud Environment (Claude Code Web)

```bash
yarn github-pr --cloud-proxy list --state open
yarn github-pr --cloud-proxy create --title "feat: feature" --body "Description"
```

Use `--cloud-proxy` when running in Claude Code cloud environment. This enables:
- HTTP proxy support via `HTTPS_PROXY`/`HTTP_PROXY` env vars
- Quote stripping from `GITHUB_TOKEN` (cloud may add literal quotes)
- Proxy git remote URL parsing (`/git/owner/repo` format)

**IMPORTANT:** Always use `--cloud-proxy` flag when running github-pr commands in cloud.

## Script Location

`scripts/github-pr.ts`

---

*Back to [CLAUDE.md](../CLAUDE.md)*
