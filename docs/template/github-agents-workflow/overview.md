# GitHub Agents Workflow - Overview

This document describes the automated AI agent workflow that manages feature requests and bug reports from submission through completion.

## Overview

The integration creates a complete pipeline using a 6-column workflow for **both feature requests and bug reports**:

1. **User submits** feature request or bug report via app UI → stored in MongoDB
2. **Admin gets Telegram notification** with one-click "Approve" button
3. **Admin approves** (via Telegram button) → server creates GitHub Issue + adds to "Backlog"
4. **Admin receives routing message** → chooses where item should start:
   - 🎨 **Product Design** - Needs UX/UI design
   - 🔧 **Tech Design** - Needs architecture planning
   - ⚡ **Ready for development** - Simple item, go straight to coding
   - 📋 **Backlog** - Keep in backlog for now
5. **Item moves to selected phase** → AI agent processes accordingly
6. **AI agent generates design/implementation**:
   - **Design agents**: Create PR with design file → Telegram notification with Approve/Reject buttons
   - **Implementation agent**: Create PR with code changes → Telegram notification with View PR button
   - **Visual verification** (UI changes): Implementation agent verifies at 400px viewport before completing
7. **Admin approves design PR** (via Telegram button) → PR auto-merged → status advances to next phase
8. **PR Review agent reviews implementation PR** (cron) → generates commit message → Telegram notification with Merge button
9. **Admin merges implementation PR** (via Telegram Merge button) → Telegram webhook marks item as Done

**Key concepts:**
- **6 board columns**: Backlog → Product Design → Technical Design → Ready for development → PR Review → Done
- **Unified workflow**: Both bugs and features use the same GitHub Projects board and workflow
- **Flexible routing**: Admin chooses starting phase for each item (simple fixes can skip design phases)
- **Type-aware agents**: Agents detect bugs vs features and use specialized prompts
- **Bug diagnostics**: Session logs, stack traces, and error messages included in bug fix prompts (NOT in GitHub issues)
- **Review Status field** tracks sub-states within each phase (empty → Waiting for Review → Approved/Request Changes)
- **Auto-advance on approval**: When approved via Telegram, the item automatically moves to the next phase
- **Implement agent auto-moves to PR Review**: After creating a PR, the item moves from "Ready for development" to "PR Review"
- **Single webhook**: All Telegram approval and routing buttons use `/api/telegram-webhook` for instant in-app feedback
- **Simplified MongoDB schema**: MongoDB stores only high-level status (4 values), GitHub Projects tracks detailed workflow
- **Separate MongoDB collections**: `feature-requests` and `reports` collections (bugs need session logs, screenshots, diagnostics)
- **Design documents as files**: Stored in `design-docs/issue-{N}/` with PR-based review workflow
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

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  App UI         │      │  MongoDB         │      │  GitHub Projects    │
│  (User/Admin)   │ ───► │  (Submissions)   │      │  (Design + Dev)     │
└─────────────────┘      └──────────────────┘      └─────────────────────┘
        │                        │                          ▲
        │                        │                          │
        ▼                        ▼                          │
┌─────────────────┐      ┌──────────────────┐              │
│  Telegram       │      │  Server Backend  │──────────────┘
│  (Approval Link)│ ───► │  (Creates Issue) │  On approval
└─────────────────┘      └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Project Management Abstraction (src/server/project-management/)       │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ ProjectManagementAdapter interface (adapter pattern)               ││
│  │ └── adapters/github.ts  # GitHub implementation                   ││
│  │ ├── types.ts            # Domain types                            ││
│  │ ├── config.ts           # Status constants, project config        ││
│  │ └── index.ts            # Singleton factory + exports             ││
│  └────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  CLI Agent Scripts (src/agents/)                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ product-design   │  │ tech-design      │  │ implement            │  │
│  │ .ts              │  │ .ts              │  │ .ts                  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ shared/                                                           │  │
│  │ ├── config.ts         # Agent-specific config + re-exports       │  │
│  │ ├── claude.ts         # Claude SDK utilities                     │  │
│  │ ├── notifications.ts  # Telegram notifications                   │  │
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
| Tech Design | 🏗️ | Tech Design Agent |
| Implementor | ⚙️ | Implementor Agent |
| PR Review | 👀 | PR Review Agent |
| Auto-Advance | ⏭️ | Auto-Advance Agent |

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
design-docs/
├── issue-123/
│   ├── product-design.md
│   └── tech-design.md
└── issue-456/
    └── product-design.md
```

**Design Agent Flow:**

1. **Agent generates design** → writes to `design-docs/issue-{N}/{type}-design.md`
2. **Agent creates branch** → `design/issue-{N}-product` or `design/issue-{N}-tech`
3. **Agent creates PR** → `docs: product design for issue #123`
4. **Telegram notification** with `[Approve & Merge]` and `[Request Changes]` buttons
5. **Admin approves** → PR auto-merged → artifact comment updated → status advances

**Feedback Mode:**
When admin clicks "Request Changes":
1. Agent finds existing design PR
2. Revises design file, pushes to same branch
3. PR auto-updates
4. Admin receives new notification

**For detailed workflow information, see:**
- [mongodb-github-status.md](./mongodb-github-status.md) - Status tracking architecture
- [setup-guide.md](./setup-guide.md) - Complete setup instructions
- [design-workflow.md](./design-workflow.md) - Design document details
- [implementation-workflow.md](./implementation-workflow.md) - Implementation process
- [pr-review-workflow.md](./pr-review-workflow.md) - PR review and merge process

## Related Documentation

- **[setup-guide.md](./setup-guide.md)** - Step-by-step setup for GitHub Projects and environment
- **[mongodb-github-status.md](./mongodb-github-status.md)** - Two-tier status tracking system
- **[agent-logging.md](./agent-logging.md)** - Complete logging system documentation (CRITICAL)
- **Main integration docs**: [../github-projects-integration.md](../github-projects-integration.md)
