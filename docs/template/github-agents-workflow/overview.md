---
title: GitHub Agents Workflow Overview
description: Architecture and flow of the AI-powered feature/bug pipeline. Use this to understand the agent workflow system.
summary: "9-status workflow (Backlog → Product Development → Product Design → Bug Investigation → Tech Design → Ready for development → PR Review → Final Review → Done) with AI agents at each stage. Items enter via UI or CLI, get approved via Telegram, and progress through design and implementation phases automatically."
priority: 2
key_points:
  - "Entry points: UI feature request, UI bug report, or CLI"
  - "Agents: Product Design, Bug Investigator, Tech Design, Implementor, PR Review, Workflow Review, Triage (standalone)"
  - "Status tracking: Source collections (high-level) + workflow-items collection (pipeline)"
  - "All actions logged to agent-logs/issue-N.md"
related_docs:
  - setup-guide.md
  - cli.md
  - workflow-e2e.md
  - bug-investigation.md
  - workflow-items-architecture.md
  - agent-logging.md
  - telegram-integration.md
  - running-agents.md
  - directory-locking.md
  - workflow-service.md
---

# GitHub Agents Workflow - Overview

This document describes the automated AI agent workflow that manages feature requests and bug reports from submission through completion.

## Overview

The integration creates a complete pipeline using a 9-status workflow for **both feature requests and bug reports**. Not all statuses are used for every item -- some are optional (Product Development) or type-specific (Bug Investigation for bugs only, Final Review for multi-phase features only).

### Entry Points

Items can enter the workflow through three paths (all converge into the same pipeline):

| Entry Point | Description | Command/Location |
|-------------|-------------|------------------|
| **UI Feature Request** | User submits via app form | `/feature-requests` page |
| **UI Bug Report** | User submits or auto-captured error | Bug report dialog |
| **CLI** | Developer creates directly | `yarn agent-workflow create` |

**See [Entry Points](./entry-points.md) for detailed documentation on each path.**

### Workflow Steps

1. **User submits** feature request or bug report via app UI (or CLI) → stored in MongoDB
2. **Admin gets Telegram notification** with one-click "Approve" button
3. **Admin approves** (via Telegram button or UI) → server creates GitHub Issue
   - **Features**: Added to "Backlog", admin receives routing message
   - **Bugs**: Auto-routed to "Bug Investigation" (no routing message)
4. **Features: Admin receives routing message** → chooses where item should start:
   - 🎨 **Product Design** - Needs UX/UI design
   - 🔧 **Tech Design** - Needs architecture planning
   - ⚡ **Ready for development** - Simple item, go straight to coding
   - 📋 **Backlog** - Keep in backlog for now
5. **Bugs: Bug Investigator agent** runs automatically → investigates root cause → posts fix options → admin selects fix approach via web UI → routes to Tech Design or Implementation
6. **Item moves to selected phase** → AI agent processes accordingly
7. **AI agent generates design/implementation**:
   - **Design agents**: Create PR with design file, save design to S3 → Telegram notification with Approve/Reject buttons
   - **Product Design agent** (new designs): Generates 2-3 interactive React mock options → admin selects via decision UI → chosen design saved to S3
   - **Implementation agent**: Create PR with code changes → Telegram notification with View PR button
   - **Visual verification** (UI changes): Implementation agent verifies at 400px viewport before completing
8. **Admin approves design** (via Telegram button or UI) → design saved to S3 → status advances to next phase (PR stays open, cleaned up when feature reaches Done)
9. **PR Review agent reviews implementation PR** (cron) → generates commit message → Telegram notification with Merge button
10. **Admin merges implementation PR** (via Telegram Merge button or UI) → marks item as Done
11. **Post-merge recovery** (if needed): Merge success notification includes "Revert" button → creates revert PR → restores status for agent to fix

**Key concepts:**
- **Board columns**: Backlog → Product Design → Bug Investigation → Technical Design → Ready for development → PR Review → Done
- **Unified workflow**: Both bugs and features use the same workflow pipeline
- **Flexible routing**: Features get admin routing choice; bugs are auto-routed to Bug Investigation
- **Bug Investigation**: Read-only agent investigates root cause, proposes fix options, admin selects approach via web UI
- **Type-aware agents**: Agents detect bugs vs features and use specialized prompts
- **Bug diagnostics**: Session logs, stack traces, and error messages included in bug investigation prompts (NOT in GitHub issues)
- **Review Status field** tracks sub-states within each phase (empty → Waiting for Review → Approved/Request Changes)
- **Auto-advance on approval**: When approved via Telegram, the item automatically moves to the next phase
- **Implement agent auto-moves to PR Review**: After creating a PR, the item moves from "Ready for development" to "PR Review"
- **Single webhook**: All Telegram approval and routing buttons use `/api/telegram-webhook` for instant in-app feedback
- **Post-merge revert**: One-click revert button on merge success → creates revert PR (not direct push) → restores status for agent to fix
- **Directory locking**: Master script acquires per-directory lock to prevent concurrent agent runs on same working directory
- **Three-tier MongoDB storage**: Source collections (`feature-requests`, `reports`) store intake data, `workflow-items` collection tracks pipeline status
- **Separate source collections**: `feature-requests` and `reports` (bugs need session logs, screenshots, diagnostics)
- **Design documents in S3**: Stored in S3 at `design-docs/issue-{N}/` keys, with PR-based review workflow (PRs are NOT merged — approval saves content from S3, PRs cleaned up on Done)
- **Artifact comments**: Track design docs and implementation PRs with status (pending → in-review → approved → merged)
- **Complete workflow logging**: ALL phases and actions logged to `agent-logs/issue-{N}.md` with structured markers

## Workflow Logging (CRITICAL)

**EVERY workflow action MUST be logged to `agent-logs/issue-{N}.md`.**

Logging is a crucial part of the workflow - it enables debugging, auditing, and the `/workflow-review` command to analyze agent behavior.

### What Gets Logged

| Source | Logged Events | Marker |
|--------|---------------|--------|
| **Agent Execution** | Phase start/end, prompts, tool calls, responses, tokens, errors | `[LOG:PHASE_START]`, `[LOG:TOOL_CALL]`, etc. |
| **Telegram Webhook** | All admin actions (approve, route, merge, request changes) | `[LOG:TELEGRAM]` |
| **GitHub Actions** | CI/CD events, deployments | `[LOG:ACTION]` |

### Log File Structure

Each issue has a dedicated log file:
```
agent-logs/
├── issue-42.md    # Complete history for issue #42
├── issue-43.md    # Complete history for issue #43
└── ...
```

### Adding New Logging

When adding new workflow functionality:

1. **Import logging functions:**
   ```typescript
   import { logWebhookAction, logWebhookPhaseStart, logWebhookPhaseEnd } from '@/agents/lib/logging';
   ```

2. **Log phase boundaries:**
   ```typescript
   logWebhookPhaseStart(issueNumber, 'My New Phase', 'telegram');
   // ... do work ...
   logWebhookPhaseEnd(issueNumber, 'My New Phase', 'success', 'telegram');
   ```

3. **Log individual actions:**
   ```typescript
   logWebhookAction(issueNumber, 'action_name', 'Description of what happened', {
       key: 'metadata',
   });
   ```

4. **Use structured markers** - All logs must use `[LOG:TYPE]` markers for grep-based analysis.

**See [agent-logging.md](./agent-logging.md) for complete logging documentation.**

## Workflow Service Layer

All transports -- Telegram, UI, CLI, and agents -- go through a unified service layer at `src/server/template/workflow-service/`. The service centralizes all business logic for the full workflow lifecycle: entry operations (approve, route, delete), mid-pipeline operations (advance, review status, phase, undo, decision), shared admin actions (design review, clarification, request changes, choose recommended, merge, revert).

**What the service handles:**
- State validation (prevent double-approval, check GitHub sync status)
- GitHub sync (issue creation via github-sync)
- Adapter status updates (move items between columns)
- Review status management (set, clear, update)
- PR merge/revert with multi-phase support
- Design review with auto-advance on approval
- Agent logging to `agent-logs/issue-{N}.md`
- Telegram notifications (universal notification center)
- Undo windows (5-minute rollback for accidental actions)

**Transports are thin wrappers:** parse input (callback data, request body, CLI args) -> call the service function -> format output for the transport.

**See [workflow-service.md](./workflow-service.md) for full documentation.**

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  App UI         │      │  MongoDB         │      │  GitHub             │
│  (User/Admin)   │ ───► │  Source Cols     │      │  (Issues + PRs)     │
└─────────────────┘      │  + workflow-items│      └─────────────────────┘
        │                └──────────────────┘              ▲
        │                        │                          │
        ▼                        ▼                          │
┌─────────────────┐      ┌──────────────────┐              │
│  Telegram       │      │  Server Backend  │──────────────┘
│  (Approval Link)│ ───► │  (Creates Issue) │  On approval
└─────────────────┘      └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Project Management Abstraction (src/server/template/project-management/)       │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ ProjectManagementAdapter interface (adapter pattern)               ││
│  │ ├── adapters/app-project.ts  # MongoDB workflow-items (recommended)││
│  │ ├── adapters/github.ts       # GitHub Projects V2 (legacy)        ││
│  │ ├── types.ts                 # Domain types                       ││
│  │ ├── config.ts                # Status constants, project config   ││
│  │ └── index.ts                 # Singleton factory + exports        ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  MongoDB Collections:                                                   │
│  ├── feature-requests  # Intake: title, description, priority, status  │
│  ├── reports           # Intake: error, stack trace, session logs       │
│  └── workflow-items    # Pipeline: status, review, priority, size, complexity, domain │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  CLI Agent Scripts (src/agents/)                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ product-design   │  │ bug-investigator │  │ tech-design          │  │
│  │ .ts              │  │ .ts              │  │ .ts                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│  ┌──────────────────┐                                                  │
│  │ implement.ts     │                                                  │
│  └──────────────────┘                                                  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ shared/                                                           │  │
│  │ ├── config.ts         # Agent-specific config + re-exports       │  │
│  │ ├── claude.ts         # Claude SDK utilities                     │  │
│  │ ├── notifications/    # Telegram notifications (split module)     │  │
│  │ ├── error-handler.ts  # Standardized agent error handling        │  │
│  │ ├── main-factory.ts   # Agent entry point boilerplate            │  │
│  │ ├── decision-utils.ts # Decision comment utilities               │  │
│  │ ├── phase-resolution.ts # Shared phase resolution logic          │  │
│  │ ├── console.ts        # CLI progress/warn formatting helpers     │  │
│  │ ├── directory-lock.ts # Directory-level concurrency lock         │  │
│  │ ├── prompts/          # Prompt templates (split by phase)        │  │
│  │ │   ├── product-design.ts, technical-design.ts, etc.            │  │
│  │ └── types.ts          # Agent-specific types                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Agent Identity Prefixes

Since all agents use the same bot account, each agent prefixes its comments with a unique emoji and name so both humans and other agents can identify who took the action.

**Agent Prefixes:**
| Agent | Emoji | Full Name |
|-------|-------|-----------|
| Product Design | 🎨 | Product Design Agent |
| Bug Investigator | 🔍 | Bug Investigator Agent |
| Tech Design | 🏗️ | Tech Design Agent |
| Implementor | ⚙️ | Implementor Agent |
| PR Review | 👀 | PR Review Agent |
| Workflow Review | 📋 | Workflow Review Agent |
| Auto-Advance | ⏭️ | Auto-Advance Agent |
| Triage | 🏷️ | Triage Agent |

**Example Comments:**

*New Design:*
```markdown
🎨 **[Product Design Agent]**

Here's the design overview:
1. Add dark mode toggle to Settings page
2. Use system preference as default
3. Show visual preview when toggling
```

*Addressing Feedback:*
```markdown
🏗️ **[Tech Design Agent]**

Here's what I changed:
1. Changed from hardcoded colors to semantic tokens
2. Added persistence using localStorage
3. Updated all components to support theme switching
```

**What Gets Prefixed:**
- ✅ All issue comments (design summaries, feedback responses, clarifications, PR links)
- ✅ All PR comments (implementation summaries, reviews, feedback resolution)
- ❌ Issue body updates (design documents remain clean)
- ❌ PR titles and descriptions (structured documents)

This allows you to quickly scan which agent did what, and enables agents to read and understand each other's actions.

## Design Document Workflow Overview

Design documents are stored as versioned files with PR-based review, providing version control and cleaner issue bodies.

**Storage Location:**
```
S3: design-docs/issue-{N}/product-design.md     (canonical design, written by Phase 2, read by next agent)
S3: design-docs/issue-{N}/tech-design.md

Branch: design-docs/issue-{N}/product-design.md  (versioned in PR, written by Phase 2)
Branch: src/pages/design-mocks/issue-{N}.tsx      (main mock page with tabs, written by Phase 1)
Branch: src/pages/design-mocks/components/issue-{N}-optA.tsx (mock options, written by Phase 1)
```

**Product Design Agent — 2-Phase Flow:**

**Phase 1** (reviewStatus = null → Waiting for Decision):
- Agent explores codebase and writes 2-3 React mock pages to `src/pages/design-mocks/`
- Creates decision for admin to choose between mock options
- Does NOT write a design document (mocks only)
- Notification: `[Choose Recommended]` `[All Options]` `[Preview Mocks]` `[Request Changes]`

**Phase 2** (reviewStatus = Decision Submitted → Waiting for Review):
- Agent reads the chosen mock option from DB
- Writes a full Product Design document based on the chosen approach
- Notification: `[Approve]` `[Request Changes]` `[View PR]`

**Other modes:**
- **Feedback** (Request Changes on Phase 2 design doc) — revises design, same as other agents
- **Clarification Needed** (ambiguous requirements) — agent posts question on issue

**Design Mock Preview Route:**

Mock pages are viewable at `/design-mocks/issue-{N}` on Vercel preview deployments (PR branches). The route is registered as a public, full-screen client route and includes a toolbar with:
- **View state** dropdown — Populated / Empty / Loading (passed as props to mock components)
- **Theme preset** dropdown — All 8 built-in themes (uses real theme store, CSS variables update instantly)
- **Dark/Light toggle** — Switches color mode via theme store

Mock components are generated with `viewState` prop support so each option renders populated data, empty state, and loading skeleton. Since the route is inside `AppThemeProvider`, semantic color tokens (`bg-background`, `text-foreground`, etc.) respond to theme/mode changes automatically.

On production (main branch), the route shows a clean "Design mock not available" fallback since mock files only exist on PR branches.

**Design Agent Flow (tech design and other design agents):**

1. **Agent generates design** → writes to `design-docs/issue-{N}/{type}-design.md` on branch + saves to S3
2. **Agent creates branch** → `design/issue-{N}-tech` etc.
3. **Agent creates PR** → `docs: tech design for issue #123`
4. **Admin approves** → design read from S3 → artifact comment updated → status advances (PR stays open, NOT merged)
5. **On feature Done** → open design PRs are closed and branches deleted

**Product Design Agent Flow (2-phase):**

1. **Phase 1: Agent creates mocks** → writes React mock pages to `src/pages/design-mocks/` on branch, creates PR, posts decision
2. **Admin selects option** → reviewStatus set to `Decision Submitted` (item stays in Product Design)
3. **Phase 2: Agent writes design doc** → reads chosen mock, writes full design doc to branch + S3, reviewStatus → `Waiting for Review`
4. **Admin approves** → design read from S3 → artifact comment updated → status advances to Tech Design
5. **On feature Done** → open design PRs are closed and branches deleted

**Feedback Mode:**
When admin clicks "Request Changes":
1. Agent finds existing design PR
2. Revises design file, pushes to same branch
3. PR auto-updates
4. Admin receives new notification

**For detailed workflow information, see:**
- [workflow-items-architecture.md](./workflow-items-architecture.md) - Workflow items data model
- [setup-guide.md](./setup-guide.md) - Complete setup instructions
- [design-workflow.md](./design-workflow.md) - Design document details
- [implementation-workflow.md](./implementation-workflow.md) - Implementation process
- [pr-review-workflow.md](./pr-review-workflow.md) - PR review and merge process

## Related Documentation

- **[setup-guide.md](./setup-guide.md)** - Step-by-step setup for environment and tokens
- **[workflow-items-architecture.md](./workflow-items-architecture.md)** - Workflow items data model and pipeline tracking
- **[agent-logging.md](./agent-logging.md)** - Complete logging system documentation (CRITICAL)
- **[directory-locking.md](./directory-locking.md)** - Directory-level lock for preventing concurrent agent runs
- **Technical reference**: [reference.md](./reference.md)
