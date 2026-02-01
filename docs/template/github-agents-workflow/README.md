# GitHub Agents Workflow Documentation

Complete guide to the AI-powered feature request and bug fix workflow using GitHub Projects V2.

## Table of Contents

### Getting Started

**[Setup Guide](./setup-guide.md)** - Complete setup instructions
- Creating GitHub Project with required fields
- Configuring GitHub tokens (admin + bot)
- Setting up Telegram notifications
- Bot account setup for PR approval
- Environment variables and configuration

### Core Concepts

**[Overview & Architecture](./overview.md)** - System design and workflow overview
- 6-column workflow (Backlog → Product Design → Tech Design → Ready for development → PR Review → Done)
- Two-tier status tracking (MongoDB high-level + GitHub Projects detailed)
- Unified workflow for features and bugs
- Agent identity prefixes and roles
- Design documents as versioned files

**[Entry Points](./entry-points.md)** - How items enter the workflow
- UI Feature Request form
- UI Bug Report (+ auto error capture)
- CLI (`yarn agent-workflow`)
- Shared notification functions
- How all entry points converge into unified flow

**[CLI Tool](./cli.md)** - Command-line interface for creating items
- Interactive mode (`yarn agent-workflow start`)
- Direct creation with arguments
- `--auto-approve` and `--route` options
- Workflow modes and examples

**[MongoDB vs GitHub Status](./mongodb-github-status.md)** - Status tracking architecture
- Why two status systems
- MongoDB statuses (4 values: new → in_progress → done → rejected)
- GitHub Project statuses (6 workflow stages)
- Review Status field for sub-states within each phase

### Workflow Execution

**[Complete Workflow Guide](./workflow-guide.md)** - End-to-end workflow with diagrams
- From user submission to merged PR
- Telegram approval flow
- Admin routing (choose starting phase)
- AI agent processing at each stage
- Auto-advance on approval
- Multi-phase vs single-phase features

**[Multi-Phase Features](./multi-phase-features.md)** - L/XL features split into sequential PRs
- How tech design generates phases
- Phase storage (GitHub comment + markdown fallback)
- Phase-aware PR review
- Artifact comment tracking
- Sequential PR workflow (Phase 1 → Phase 2 → Phase 3)

### Running and Managing Agents

**[Running Agents](./running-agents.md)** - How to execute agents
- Master command (`yarn github-workflows-agent --all`)
- Individual agent commands
- Agents copy project setup (recommended)
- Manual vs automated execution
- Agent execution logs (Markdown format per issue)
- Common options (--dry-run, --stream, --limit)

**[Feedback & Reviews](./feedback-and-reviews.md)** - Handling feedback loops
- "Request Changes" workflow
- Agent clarification flow (asks questions when ambiguous)
- Finding correct PR in multi-phase features
- PR review state and multiple review cycles
- Writing effective review comments
- Rejection handling

### Integrations

**[Telegram Integration](./telegram-integration.md)** - Telegram notifications and buttons
- Approval buttons (features and bugs)
- Design PR approval (Approve & Merge, Request Changes)
- Implementation PR notifications (View PR button, reviewed by PR Review agent)
- PR Review agent approval (Merge, Request Changes)
- Routing notifications (choose starting phase)
- Callback webhook architecture
- Setting up Telegram webhook

### Reference & Troubleshooting

**[Agent Library Abstraction](./agent-library-abstraction.md)** - Swappable AI provider architecture
- Provider adapters (Claude Code, Gemini CLI, OpenAI Codex)
- CLI abstraction layer
- Prompt templates and builders
- Environment configuration
- Testing different AI providers

**[Troubleshooting](./troubleshooting.md)** - Common issues and solutions
- Token and permission errors
- Agent timeouts
- Git conflicts
- API rate limits
- Concurrent execution edge cases

**[Technical Reference](./reference.md)** - Implementation details
- File structure
- Project Management Adapter API
- Status constants and configuration
- PR merge flow (admin approval)
- Status update architecture (Telegram webhook as single source of truth)
- GitHub Actions workflows

## Quick Start

1. **Setup**: Follow [Setup Guide](./setup-guide.md) to configure GitHub Project, tokens, and Telegram
2. **Understand**: Read [Overview](./overview.md) to understand the 6-column workflow
3. **Run**: Use [Running Agents](./running-agents.md) to start processing feature requests
4. **Learn**: Review [Workflow Guide](./workflow-guide.md) for complete flow details

## Key Features

- ✅ **Squash-merge ready PRs** - No editing needed before merge
- ✅ **Phase-aware reviews** - Verifies each PR implements only its designated phase
- ✅ **Auto-completion** - Status updates to Done when final PR merges
- ✅ **Telegram quick actions** - Approve/reject with inline buttons
- ✅ **Type-aware agents** - Different prompts for bugs vs features
- ✅ **Design versioning** - Design docs stored as files with PR-based review
- ✅ **Multi-phase support** - Large features split into 2-5 independently mergeable PRs

## Related Documentation

- [Telegram Notifications (App Runtime)](../telegram-notifications.md) - Application-level notifications
- [GitHub PR CLI](../github-pr-cli-guide.md) - Managing PRs via command line
- [Vercel CLI](../vercel-cli-guide.md) - Deployment management
