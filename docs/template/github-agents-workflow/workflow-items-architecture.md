# Workflow Items Architecture

How workflow items are stored, connected to feature requests and bug reports, and tracked through the pipeline.

The system uses a dedicated `workflow-items` MongoDB collection to own the pipeline lifecycle. Source collections (`feature-requests`, `reports`) remain as intake storage. Items from any entry point (UI, CLI) flow into the same pipeline.

## Collections

| Collection | Purpose | Who writes |
|------------|---------|-----------|
| `feature-requests` | Intake, approval lifecycle, user-facing data | UI, CLI, Telegram webhook |
| `reports` | Intake, diagnostics (session logs, stack traces) | UI, CLI, auto-capture |
| `workflow-items` | Pipeline status tracking for active items | Project management adapter, agents |

## Collections Overview

### Source Collections (feature-requests, reports)

These are the **intake** collections. Items start here when submitted via UI or CLI.

**Feature Requests:**
| Status | Meaning |
|--------|---------|
| `new` | Submitted, not yet approved |
| `in_progress` | Approved, synced to GitHub (pipeline status in workflow-items) |
| `done` | Completed and merged |
| `rejected` | Not going to implement |

**Bug Reports:**
| Status | Meaning |
|--------|---------|
| `new` | Submitted, not yet approved |
| `investigating` | Approved, synced to GitHub (pipeline status in workflow-items) |
| `resolved` | Fixed and merged |
| `closed` | Won't fix, duplicate, or not a bug |

Both collections store a `githubProjectItemId` field that points to the corresponding `workflow-items._id` once the item enters the pipeline.

### Workflow-Items Collection

This is the **pipeline** collection. Items are created here when approved and synced to GitHub. All agents and the admin workflow UI read/write this collection for pipeline status.

```typescript
{
    _id: ObjectId,
    type: 'feature' | 'bug' | 'task',   // Item type
    title: string,
    description?: string,
    status: string,                       // Pipeline phase (see below)
    reviewStatus?: string,                // Sub-state within phase
    implementationPhase?: string,         // '1/3', '2/3' for multi-phase features
    sourceRef?: {                         // Back-reference (null for standalone tasks)
        collection: 'feature-requests' | 'reports',
        id: ObjectId,
    },
    githubIssueNumber?: number,
    githubIssueUrl?: string,
    githubIssueTitle?: string,
    labels?: string[],                    // GitHub issue labels
    createdAt: Date,
    updatedAt: Date,
}
```

**Pipeline statuses:**
| Status | Meaning |
|--------|---------|
| `Backlog` | Approved, not yet started |
| `Product Design` | AI generates product design, human reviews |
| `Bug Investigation` | AI investigates root cause, proposes fixes |
| `Technical Design` | AI generates tech design, human reviews |
| `Ready for development` | AI implements the feature/fix |
| `PR Review` | PR created, waiting for human review/merge |
| `Done` | Completed and merged |

**Review statuses** (sub-state within any pipeline phase):
| Status | Meaning |
|--------|---------|
| *(empty)* | Agent is working or item hasn't been picked up |
| `Waiting for Review` | Agent completed work, waiting for admin |
| `Approved` | Admin approved (auto-advances to next phase) |
| `Request Changes` | Admin requested changes (agent revises) |
| `Rejected` | Admin rejected |

## How Items Enter the Pipeline

### Entry Point 1: UI Feature Request
```
User submits form (/feature-requests page)
  → feature-requests doc created (status: 'new')
  → Telegram approval notification sent
  → Admin approves via Telegram
  → Source doc status: 'in_progress'
  → GitHub issue created
  → workflow-items doc created
  → Source doc githubProjectItemId = workflow-item _id
```

### Entry Point 2: UI Bug Report
```
User submits bug report (or auto-captured error)
  → reports doc created (status: 'new')
  → Telegram approval notification sent
  → Admin approves via Telegram
  → Source doc status: 'investigating'
  → GitHub issue created
  → workflow-items doc created (auto-routed to Bug Investigation)
  → Source doc githubProjectItemId = workflow-item _id
```

### Entry Point 3: CLI
```
yarn agent-workflow create --type feature --title "..." --auto-approve
  → feature-requests doc created (status: 'in_progress')
  → GitHub issue created
  → workflow-items doc created
  → Source doc githubProjectItemId = workflow-item _id
  → Optional: --workflow-route to set initial pipeline phase
```

Without `--auto-approve`, the CLI creates the source doc with `status: 'new'` and sends a Telegram notification (same as UI flow).

## Cross-Collection Relationships

```
feature-requests / reports              workflow-items
┌──────────────────────┐               ┌──────────────────────┐
│ _id: ObjectId        │               │ _id: ObjectId        │
│ ...                  │  points to    │ type: 'feature'      │
│ githubProjectItemId ─┼──────────────►│ status: 'Tech Design'│
│                      │               │ reviewStatus: ...    │
│                      │  points back  │ sourceRef: {         │
│                      │◄──────────────┼─  collection, id     │
│                      │               │ }                    │
└──────────────────────┘               │ githubIssueNumber    │
                                       └──────────────────────┘
```

- **Source → Workflow**: `githubProjectItemId` stores the workflow-item `_id`
- **Workflow → Source**: `sourceRef.collection` + `sourceRef.id` points back to source doc
- **Standalone tasks**: `sourceRef` is null (no source document)

## Admin UI: Workflow Page

The `/admin/workflow` page shows two sections:

**Pending Approval** — Items with `status: 'new'` from source collections that don't have a `githubProjectItemId` yet. Clicking navigates to the item detail page for approval.

**Pipeline** — Active items from the `workflow-items` collection. Shows pipeline status, review status, and type badge. Clicking navigates to the item detail page using the `sourceRef` composite ID.

Filter chips (All / Features / Bugs) filter both sections by item type.

## Project Management Adapter

The `ProjectManagementAdapter` interface abstracts all pipeline operations. The adapter type is configured via `PROJECT_MANAGEMENT_TYPE` env var:

| Value | Adapter | Pipeline Storage |
|-------|---------|-----------------|
| `app` (recommended) | `AppProjectAdapter` | `workflow-items` MongoDB collection |
| `github` (legacy) | `GitHubProjectsAdapter` | GitHub Projects V2 board |

The `app` adapter stores pipeline status in the `workflow-items` collection and delegates GitHub operations (issues, PRs, branches) to `GitHubClient`. The `github` adapter stores pipeline status directly on GitHub Projects V2 cards via GraphQL.

## Code Locations

| What | Where |
|------|-------|
| Workflow-items types | `src/server/database/collections/template/workflow-items/types.ts` |
| Workflow-items CRUD | `src/server/database/collections/template/workflow-items/workflow-items.ts` |
| AppProjectAdapter | `src/server/project-management/adapters/app-project.ts` |
| Adapter factory | `src/server/project-management/index.ts` |
| Sync core (creates workflow-items) | `src/server/github-sync/sync-core.ts` |
| Workflow API handler | `src/apis/template/workflow/handlers/listItems.ts` |
| Workflow UI | `src/client/routes/template/Workflow/WorkflowItems.tsx` |
| Migration script | `scripts/template/migrate-workflow-items.ts` |

## Migration

For existing deployments with items tracked via the old composite ID system, run:

```bash
# Preview what will be migrated
npx tsx scripts/template/migrate-workflow-items.ts --dry-run

# Run migration
npx tsx scripts/template/migrate-workflow-items.ts
```

The migration creates `workflow-items` documents from existing synced features/reports and updates their `githubProjectItemId` to point to the new workflow-item `_id`.

## Related Documentation

- **[overview.md](./overview.md)** - Complete system overview
- **[setup-guide.md](./setup-guide.md)** - Setup instructions
- **[cli.md](./cli.md)** - CLI usage
