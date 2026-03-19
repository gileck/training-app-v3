# GitHub Agents Workflow Documentation

Complete guide to the AI-powered feature request and bug fix workflow.

## Table of Contents

### Getting Started

**[Setup Guide](./setup-guide.md)** - Complete setup instructions
- Configuring GitHub tokens (admin + bot)
- Setting up Telegram notifications
- Bot account setup for PR approval
- Environment variables and configuration

**[Setup Guide (Legacy GitHub Projects)](./setup-guide-legacy-github-projects.md)** - Deprecated setup guide for the legacy GitHub Projects V2 integration (kept for reference)

### Architecture & Core Concepts

**[Overview & Architecture](./overview.md)** - System design and 9-status workflow overview
- Status tracking (source collections + workflow-items pipeline)
- Unified workflow for features and bugs
- Agent identity prefixes and roles
- Design documents as versioned files

**[Entry Points](./entry-points.md)** - How items enter the workflow
- UI Feature Request form
- UI Bug Report (+ auto error capture)
- CLI (`yarn agent-workflow`)
- Shared notification functions
- How all entry points converge into unified flow

**[CLI Tool](./cli.md)** - Command-line interface for creating and managing items
- Interactive mode (`yarn agent-workflow start`)
- Direct creation with arguments
- `--auto-approve` and `--route` options
- Workflow modes and examples

**[Workflow Items Architecture](./workflow-items-architecture.md)** - Data model and pipeline tracking
- Dedicated `workflow-items` collection for pipeline status
- How items connect to feature-requests, reports, and CLI
- Cross-collection relationships and entry points
- Admin UI (Pending Approval + Pipeline sections)

**[Workflow Service](./workflow-service.md)** - Unified service layer for all lifecycle operations
- Centralized business logic (approve, route, delete, advance, review, merge, revert, undo, decision)
- Transport-agnostic design (Telegram, UI, CLI, agents)

### Workflow Execution

**[Complete Workflow Guide](./workflow-guide.md)** - End-to-end workflow with diagrams
- From user submission to merged PR
- Telegram approval flow
- Admin routing (choose starting phase)
- AI agent processing at each stage
- Auto-advance on approval
- Multi-phase vs single-phase features

**[Workflow E2E Scenarios](./workflow-e2e.md)** - Visual diagrams for all workflow scenarios
- Simple features, multi-phase features, bug fixes
- Request Changes and clarification flows
- 5-minute undo window
- Rejection scenarios

**[Multi-Phase Features](./multi-phase-features.md)** - L/XL features split into sequential PRs
- How tech design generates phases
- Phase storage (GitHub comment + markdown fallback)
- Phase-aware PR review
- Artifact comment tracking
- Sequential PR workflow (Phase 1 -> Phase 2 -> Phase 3)

**[Feedback & Reviews](./feedback-and-reviews.md)** - Handling feedback loops
- "Request Changes" workflow
- Agent clarification flow (asks questions when ambiguous)
- Finding correct PR in multi-phase features
- PR review state and multiple review cycles
- Writing effective review comments
- Rejection handling

### Agent Reference

**[Running Agents](./running-agents.md)** - How to execute agents
- Master command (`yarn github-workflows-agent --all`)
- Individual agent commands
- Agents copy project setup (recommended)
- Manual vs automated execution
- Common options (--dry-run, --stream, --limit)

**[Bug Investigation](./bug-investigation.md)** - Bug Investigator agent and fix selection flow
- Read-only investigation using TRACE/IDENTIFY/SCOPE/PROPOSE methodology
- Root cause analysis with fix options
- Auto-submit for obvious simple fixes
- Admin fix selection via web UI

**[Workflow Review](./workflow-review.md)** - Post-completion review agent
- Analyzes agent execution logs for completed items
- Creates improvement issues from findings
- Appends [LOG:REVIEW] section to log files

**[Agent Logging](./agent-logging.md)** - Structured logging system for agent executions
- Per-issue log files at `agent-logs/issue-{N}.md`
- Phase start/end markers, error tracking, token usage

**[Agent Tasks](./agent-tasks.md)** - Scheduled task configuration via task-cli
- Single task using `--all --global-limit` on 10-minute intervals
- Task config and run output in `agent-tasks/all/`

**[Agent Library Abstraction](./agent-library-abstraction.md)** - Swappable AI provider architecture
- Provider adapters (Claude Code, Gemini CLI, OpenAI Codex)
- CLI abstraction layer
- Prompt templates and builders
- Environment configuration

### Integrations

**[Telegram Integration](./telegram-integration.md)** - Telegram notifications and buttons
- Approval buttons (features and bugs)
- Design approval (Approve, Request Changes)
- Implementation PR notifications
- Routing notifications (choose starting phase)
- Callback webhook architecture

### Infrastructure

**[Directory Locking](./directory-locking.md)** - Prevents concurrent agent runs on the same working directory
- PID-based ownership with stale detection
- Protects git operations and file modifications

### Testing

**[E2E Tests](./e2e-tests.md)** - End-to-end workflow tests
- Mocks only at system boundaries (LLM, Telegram, filesystem)
- Runs real code for artifacts, phases, parsing, workflow-db against in-memory MongoDB

### Reference & Troubleshooting

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
- Status update architecture

## Quick Start

1. **Setup**: Follow [Setup Guide](./setup-guide.md) to configure GitHub tokens and Telegram
2. **Understand**: Read [Overview](./overview.md) to understand the workflow architecture
3. **Run**: Use [Running Agents](./running-agents.md) to start processing feature requests
4. **Learn**: Review [Workflow Guide](./workflow-guide.md) for complete flow details

## Related Documentation

- [Telegram Notifications (App Runtime)](../telegram-notifications.md) - Application-level notifications
- [GitHub PR CLI](../github-pr-cli-guide.md) - Managing PRs via command line
- [Vercel CLI](../vercel-cli-guide.md) - Deployment management
