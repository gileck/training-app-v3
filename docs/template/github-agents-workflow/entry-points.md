# Workflow Entry Points

This document explains the different ways to create feature requests and bug reports, and how they all converge into the unified GitHub agents workflow.

## Overview

There are **three entry points** to the workflow, but they all converge into the **same processing pipeline**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTRY POINTS                                       │
├─────────────────┬─────────────────────┬─────────────────────────────────────┤
│  UI Feature     │  UI Bug Report      │  CLI                                │
│  Request Form   │  (+ Auto Errors)    │  (yarn agent-workflow)              │
└────────┬────────┴──────────┬──────────┴──────────────────┬──────────────────┘
         │                   │                              │
         ▼                   ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONGODB STORAGE                                      │
│  ┌─────────────────────┐        ┌─────────────────────────────────────────┐ │
│  │ feature-requests    │        │ reports                                 │ │
│  │ collection          │        │ collection (bugs + auto errors)         │ │
│  └─────────────────────┘        └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                      │
         ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TELEGRAM NOTIFICATIONS                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ sendFeatureRequestNotification()  │  sendBugReportNotification()       │ │
│  │ - Approval button                 │  - Approval button                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  (or --auto-approve in CLI skips this step)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                      │
         └──────────────────┬───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GITHUB SYNC (src/server/github-sync/)                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ syncFeatureRequestToGitHub()  │  syncBugReportToGitHub()               │ │
│  │         │                     │         │                              │ │
│  │         └──────────┬──────────┴─────────┘                              │ │
│  │                    ▼                                                   │ │
│  │           syncItemToGitHub<T>() (sync-core.ts)                         │ │
│  │           - Creates GitHub Issue                                       │ │
│  │           - Creates workflow-item document                              │ │
│  │           - Sets pipeline status to Backlog                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TELEGRAM ROUTING                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ sendFeatureRoutingNotification()  │  sendBugRoutingNotification()      │ │
│  │ - Product Dev / Design / Tech / Implementation / Backlog buttons       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  (or --route in CLI auto-routes directly)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW PIPELINE (workflow-items collection)              │
│                                                                              │
│  Backlog → Product Design → Tech Design → Implementation → PR Review → Done │
│                                                                              │
│  (Same pipeline for ALL entry points - features and bugs)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Entry Point 1: UI Feature Request Form

Users submit feature requests through the app UI.

**Location:** `/feature-requests` page in the app

**Flow:**
1. User fills out feature request form (title, description, page)
2. API handler `createFeatureRequest` saves to MongoDB with `status: 'new'`
3. `sendFeatureRequestNotification()` sends Telegram notification with Approve button
4. Admin clicks Approve → `approveFeatureRequest()` syncs to GitHub
5. `sendFeatureRoutingNotification()` asks admin where to route
6. Admin routes → item moves to selected phase

**Code Path:**
```
src/apis/feature-requests/handlers/createFeatureRequest.ts
  → src/server/telegram/index.ts (sendFeatureRequestNotification)
  → src/server/github-sync/index.ts (approveFeatureRequest, syncFeatureRequestToGitHub)
  → src/server/telegram/index.ts (sendFeatureRoutingNotification)
```

## Entry Point 2: UI Bug Report

Users submit bug reports or the app auto-captures errors.

**Location:** Bug report dialog in the app (manual) or automatic error capture

**Flow:**
1. User submits bug report OR error is auto-captured
2. API handler `createReport` saves to MongoDB with `status: 'new'`
3. For user-submitted bugs: `sendBugReportNotification()` sends Telegram notification
4. Admin clicks Approve → `approveBugReport()` syncs to GitHub
5. `sendBugRoutingNotification()` asks admin where to route
6. Admin routes → item moves to selected phase

**Code Path:**
```
src/apis/reports/handlers/createReport.ts
  → src/server/telegram/index.ts (sendBugReportNotification)
  → src/server/github-sync/index.ts (approveBugReport, syncBugReportToGitHub)
  → src/server/telegram/index.ts (sendBugRoutingNotification)
```

**Note:** Automatic error reports (type: 'error') don't send approval notifications - only user-submitted bugs do.

## Entry Point 3: CLI

Developers create items directly via command line.

**Location:** `yarn agent-workflow` command

**Flow (default - no flags):**
1. Developer runs `yarn agent-workflow create --type feature --title "..." --description "..."`
2. CLI saves to MongoDB with `status: 'new'`
3. `sendFeatureRequestNotification()` sends Telegram notification with Approve button
4. Same flow as UI from here

**Flow (with --auto-approve):**
1. Developer runs `yarn agent-workflow create --type feature --title "..." --description "..." --auto-approve`
2. CLI saves to MongoDB with `status: 'in_progress'`
3. Immediately syncs to GitHub (skips approval notification)
4. `sendFeatureRoutingNotification()` asks admin where to route

**Flow (with --route):**
1. Developer runs `yarn agent-workflow create --type feature --title "..." --description "..." --route implementation`
2. CLI saves to MongoDB with `status: 'in_progress'`
3. Immediately syncs to GitHub
4. Auto-routes to specified phase (skips routing notification)

**Code Path:**
```
src/agents/cli/index.ts
  → src/agents/cli/commands/create.ts
    → src/server/telegram/index.ts (sendFeatureRequestNotification OR sendBugReportNotification)
    → src/server/github-sync/index.ts (syncFeatureRequestToGitHub OR syncBugReportToGitHub)
    → src/server/telegram/index.ts (sendFeatureRoutingNotification OR sendBugRoutingNotification)
```

## Shared Components

All entry points use these shared components:

### Telegram Notifications (`src/server/telegram/index.ts`)

| Function | Purpose | Entry Points |
|----------|---------|--------------|
| `sendFeatureRequestNotification()` | Approval notification for new feature | UI, CLI |
| `sendBugReportNotification()` | Approval notification for new bug | UI, CLI |
| `sendFeatureRoutingNotification()` | Routing buttons after approval | UI, CLI |
| `sendBugRoutingNotification()` | Routing buttons after approval | UI, CLI |

### GitHub Sync (`src/server/github-sync/`)

The GitHub sync service uses a **shared core architecture** to eliminate duplication between feature requests and bug reports:

```
src/server/github-sync/
├── index.ts       # Public API - type-specific wrappers
├── sync-core.ts   # Shared sync logic (generic functions)
└── types.ts       # Shared types and interfaces
```

**Public API (`index.ts`):**

| Function | Purpose | Entry Points |
|----------|---------|--------------|
| `syncFeatureRequestToGitHub()` | Create GitHub issue for feature | UI, CLI |
| `syncBugReportToGitHub()` | Create GitHub issue for bug | UI, CLI |
| `approveFeatureRequest()` | Update status + sync (UI approval flow) | UI |
| `approveBugReport()` | Update status + sync (UI approval flow) | UI |

**Shared Core (`sync-core.ts`):**

Both `syncFeatureRequestToGitHub()` and `syncBugReportToGitHub()` use the same generic `syncItemToGitHub<T>()` function internally. This 9-step workflow is defined once:

1. Get item from database
2. Check if already synced (return existing result)
3. Initialize project management adapter
4. Create GitHub issue (title, body, labels)
5. Add issue to project board
6. Set status to Backlog
7. Create empty artifact comment
8. Update MongoDB with GitHub fields
9. Send routing notification (unless skipped)

Similarly, `approveFeatureRequest()` and `approveBugReport()` use a shared `approveItem<T>()` function.

**Configuration Pattern:**

Each item type provides a `SyncItemConfig<T>` with type-specific behavior:

```typescript
const featureRequestSyncConfig: SyncItemConfig<FeatureRequestDocument> = {
    getFromDB: (id) => featureRequests.findFeatureRequestById(id),
    getTitle: (item) => item.title,
    buildBody: buildFeatureIssueBody,
    getLabels: getFeatureLabels,
    // ... other type-specific functions
};
```

This architecture makes it easy to add new item types in the future while keeping the core sync logic in one place.

### MongoDB Collections

| Collection | Document Type | Entry Points |
|------------|---------------|--------------|
| `feature-requests` | Feature requests | UI Feature Form, CLI (--type feature) |
| `reports` | Bug reports + auto errors | UI Bug Report, CLI (--type bug) |

## Status Flow

All entry points follow the same status progression:

### MongoDB Status (High-Level)
```
new → in_progress → done
                 → rejected
```

### Pipeline Status (workflow-items collection)
```
Backlog → Product Design → Tech Design → Ready for development → PR Review → Done
```

## Comparison Table

| Aspect | UI Feature | UI Bug | CLI |
|--------|------------|--------|-----|
| **Approval** | Required (Telegram) | Required (Telegram) | Optional (--auto-approve) |
| **Routing** | Required (Telegram) | Required (Telegram) | Optional (--route) |
| **Status on Create** | `new` | `new` | `new` or `in_progress` |
| **User Association** | Logged-in user | Logged-in user | None (CLI) |
| **MongoDB Collection** | feature-requests | reports | Either |
| **GitHub Label** | `feature-request` | `bug` | Either |

## CLI Quick Reference

```bash
# Default: sends approval notification, waits for Telegram
yarn agent-workflow create --type feature --title "Add dark mode" --description "..."

# Auto-approve: syncs immediately, sends routing notification
yarn agent-workflow create --type feature --title "Add dark mode" --description "..." --auto-approve

# Auto-approve + route: syncs and routes immediately (no notifications)
yarn agent-workflow create --type feature --title "Fix typo" --description "..." --route implementation

# Same options work for bugs
yarn agent-workflow create --type bug --title "Login broken" --description "..." --auto-approve --route tech-design
```

## See Also

- [CLI Documentation](./cli.md) - Full CLI reference
- [Telegram Integration](./telegram-integration.md) - Telegram webhook and buttons
- [Workflow Guide](./workflow-guide.md) - Complete workflow details
- [Overview](./overview.md) - Architecture and concepts
