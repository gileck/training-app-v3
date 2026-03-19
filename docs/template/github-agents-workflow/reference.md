# GitHub Agents Workflow - Technical Reference

> **Note:** Some sections of this document (particularly File Structure and Environment Variables) may be outdated. The file structure has been significantly refactored — agents now live in `src/agents/core-agents/` with shared code in `src/agents/shared/` and `src/agents/lib/`. The project management layer uses `src/server/template/project-management/` with DI-based adapters. For up-to-date architecture information, see [overview.md](./overview.md) and individual agent AGENTS.md files.

This document provides technical details about the architecture, file structure, and implementation details of the GitHub agents workflow.

## Status Constants

### Main Statuses (STATUSES)

Workflow pipeline phases - the primary workflow columns/statuses.

| Constant | Display Value | Description |
|----------|---------------|-------------|
| `backlog` | "Backlog" | New items, not yet started |
| `productDevelopment` | "Product Development" | (Optional) AI transforms vague ideas into product specs |
| `productDesign` | "Product Design" | AI generates UX/UI design, human reviews |
| `bugInvestigation` | "Bug Investigation" | AI investigates bug root cause, human selects fix approach |
| `techDesign` | "Technical Design" | AI generates tech design, human reviews |
| `implementation` | "Ready for development" | AI implements and creates PR |
| `prReview` | "PR Review" | PR created, awaiting review/merge |
| `finalReview` | "Final Review" | (Multi-phase only) Final PR from feature branch to main |
| `done` | "Done" | Completed and merged |

### Review Statuses (REVIEW_STATUSES)

Custom field values for tracking review state within each phase.

| Constant | Display Value | Description |
|----------|---------------|-------------|
| `waitingForReview` | "Waiting for Review" | AI finished, human needs to review |
| `approved` | "Approved" | Human approved, ready to advance |
| `requestChanges` | "Request Changes" | Human wants revisions |
| `rejected` | "Rejected" | Won't proceed |
| `waitingForClarification` | "Waiting for Clarification" | Agent needs more info from admin |
| `clarificationReceived` | "Clarification Received" | Admin provided clarification |

### Custom Fields

| Field Name | Purpose |
|------------|---------|
| `Review Status` | Tracks review state within phases |
| `Implementation Phase` | Multi-PR workflow tracking (format: "X/N", e.g., "1/3") |

### Import in Code

```typescript
import { STATUSES, REVIEW_STATUSES } from '@/server/template/project-management';

// Usage
if (item.status === STATUSES.prReview) {
    // Handle PR review phase
}

if (item.reviewStatus === REVIEW_STATUSES.approved) {
    // Move to next phase
}
```

## File Structure

### Main Project

```
src/
├── agents/                          # AI agent workflows
│   ├── agents.config.ts             # Agent library configuration
│   ├── product-design-agent/
│   │   ├── workflow.ts              # Product design agent entry
│   │   └── prompt.md                # Product design prompt template
│   ├── tech-design-agent/
│   │   ├── workflow.ts              # Tech design agent entry
│   │   └── prompt.md                # Tech design prompt template
│   ├── implement-agent/
│   │   ├── workflow.ts              # Implementation agent entry
│   │   └── prompt.md                # Implementation prompt template
│   ├── pr-review-agent/
│   │   ├── workflow.ts              # PR review agent entry (cron)
│   │   └── prompt.md                # PR review prompt template
│   ├── lib/
│   │   ├── logging/                 # Agent logging utilities
│   │   │   ├── index.ts             # Main logging interface
│   │   │   ├── base-logger.ts       # Abstract logger class
│   │   │   ├── file-logger.ts       # File-based logging
│   │   │   └── vercel-logs.ts       # Vercel KV logging
│   │   └── claude-code-sdk.ts       # Claude Code SDK wrapper
│   └── shared/                      # Shared agent utilities
│       ├── claude.ts                # Claude API helpers
│       ├── github.ts                # GitHub API helpers
│       ├── prompt-utils.ts          # Prompt formatting
│       └── utils.ts                 # General utilities
│
├── apis/
│   ├── features/                    # Feature request APIs
│   │   ├── types.ts
│   │   ├── server.ts
│   │   └── handlers/
│   │       ├── create-feature.ts
│   │       ├── approve-feature.ts
│   │       └── route-feature.ts
│   └── bugs/                        # Bug report APIs
│       ├── types.ts
│       ├── server.ts
│       └── handlers/
│           ├── create-bug.ts
│           └── approve-bug.ts
│
├── server/
│   ├── github/                      # GitHub integration
│   │   ├── github-api.ts            # GraphQL API client
│   │   ├── github-cli.ts            # CLI wrapper
│   │   ├── project-adapter.ts       # Project management interface
│   │   └── projects-adapter.ts      # GitHub Projects V2 adapter
│   ├── telegram/                    # Telegram integration
│   │   ├── index.ts                 # Main Telegram utilities
│   │   ├── telegram-api.ts          # Bot API wrapper
│   │   └── telegram-webhooks.ts     # Webhook handlers
│   └── database/
│       └── collections/
│           ├── features.ts          # Feature requests collection
│           └── bugs.ts              # Bug reports collection
│
└── pages/
    └── api/
        ├── telegram-webhook.ts      # Telegram webhook endpoint
        ├── github-webhook.ts        # GitHub webhook endpoint
        └── cron/
            └── pr-review.ts         # PR review cron job

scripts/
├── init-agents-copy.ts              # Create agents-copy project
├── verify-setup.ts                  # Verify workflow setup
└── cli/
    ├── github-pr/                   # GitHub PR CLI
    │   └── index.ts
    └── github-project-id/           # Project ID helper
        └── index.ts

.github/
└── workflows/
    ├── pr-merged-mark-done.yml      # PR merge → mark Done workflow
    └── cron-pr-review.yml           # Scheduled PR reviews
```

### Agents Copy Project (Separate Repository)

Created by `yarn init-agents-copy`:

```
../app-template-ai-agents/
├── src/
│   └── agents/                      # Synced from main project
│       ├── product-design-agent/
│       ├── tech-design-agent/
│       ├── implement-agent/
│       ├── pr-review-agent/
│       ├── lib/
│       └── shared/
├── package.json                     # Minimal dependencies
├── tsconfig.json
└── .env                             # Separate env vars
```

## Project Management Adapter

The system uses an adapter pattern to support different project management backends.

### Interface: `ProjectManagementAdapter`

Located in: `src/server/github/project-adapter.ts`

```typescript
export interface ProjectManagementAdapter {
  // Create item in backlog
  createItem(params: {
    title: string;
    body: string;
    labels?: string[];
  }): Promise<{ issueNumber: number; projectItemId: string }>;

  // Update item status
  updateStatus(projectItemId: string, status: ProjectStatus): Promise<void>;

  // Get current status
  getStatus(projectItemId: string): Promise<ProjectStatus | null>;

  // Move item to next phase
  moveToNextPhase(projectItemId: string): Promise<void>;

  // Mark item as done
  markAsDone(projectItemId: string): Promise<void>;

  // Merge pull request (returns merge commit SHA)
  mergePullRequest(
    prNumber: number,
    commitTitle: string,
    commitMessage: string
  ): Promise<string>;

  // Get merge commit SHA for a merged PR
  getMergeCommitSha(prNumber: number): Promise<string | null>;

  // Create revert PR for a merged PR
  createRevertPR(
    mergeCommitSha: string,
    originalPrNumber: number,
    issueNumber: number
  ): Promise<{ prNumber: number; url: string } | null>;
}
```

### GitHub Projects V2 Implementation

Located in: `src/server/github/projects-adapter.ts`

```typescript
export class GitHubProjectsAdapter implements ProjectManagementAdapter {
  private projectId: string;
  private statusFieldId: string;
  private statusOptions: Map<ProjectStatus, string>;

  constructor(config: {
    projectId: string;
    statusFieldId: string;
    statusOptions: Record<ProjectStatus, string>;
  });

  async createItem(params): Promise<{ issueNumber: number; projectItemId: string }>;
  async updateStatus(projectItemId: string, status: ProjectStatus): Promise<void>;
  async getStatus(projectItemId: string): Promise<ProjectStatus | null>;
  async moveToNextPhase(projectItemId: string): Promise<void>;
  async markAsDone(projectItemId: string): Promise<void>;
}
```

**Key Implementation Details:**

1. **Status Field ID:** Single-select field in GitHub Projects
   - Retrieved via GraphQL: `projectV2.field(name: "Status").id`
   - Used to update item status

2. **Status Options:** Mapping of status names to option IDs
   ```typescript
   {
     backlog: "f_abc123",
     productDesign: "f_def456",
     techDesign: "f_ghi789",
     readyForDev: "f_jkl012",
     prReview: "f_mno345",
     done: "f_pqr678"
   }
   ```

3. **GraphQL Operations:**
   - Create: `createIssue` + `addProjectV2ItemById`
   - Update: `updateProjectV2ItemFieldValue`
   - Query: `projectV2Item.fieldValueByName`

### Using the Adapter

```typescript
import { getProjectAdapter } from '@/server/github/projects-adapter';

// Get adapter instance (singleton)
const adapter = getProjectAdapter();

// Create item
const { issueNumber, projectItemId } = await adapter.createItem({
  title: 'Feature: Add dark mode',
  body: 'Description...',
  labels: ['feature', 'enhancement']
});

// Update status
await adapter.updateStatus(projectItemId, 'readyForDev');

// Move to next phase
await adapter.moveToNextPhase(projectItemId);

// Mark as done
await adapter.markAsDone(projectItemId);
```

## PR Merge Flow (Admin Approval)

When admin approves a PR merge via Telegram:

### 1. Telegram Callback Handler

Located in: `src/pages/api/telegram-webhook.ts`

```typescript
if (action === 'merge') {
  // 1. Get saved commit message from PR comment
  const commitMessage = await getSavedCommitMessage(prNumber);

  // 2. Merge PR using GitHub API
  await mergePR({
    owner,
    repo,
    prNumber,
    commitMessage,
    mergeMethod: 'squash'
  });

  // 3. Send confirmation to admin
  await sendTelegramMessage(chatId, `✅ PR #${prNumber} merged successfully`);

  // 4. Update Telegram message (remove buttons)
  await editMessageButtons(messageId, []);
}
```

### 2. GitHub Webhook Handler

Located in: `src/pages/api/github-webhook.ts`

```typescript
// Triggered when PR state changes to "closed" with merged=true
if (action === 'closed' && pr.merged) {
  // 1. Extract feature/bug ID from PR description
  const itemId = extractItemId(pr.body);

  // 2. Get project item ID
  const item = await db.features.findById(itemId);

  // 3. Mark as done in GitHub Projects
  await adapter.markAsDone(item.projectItemId);

  // 4. Update MongoDB status
  await db.features.updateStatus(itemId, 'done');

  // 5. Notify admin
  await sendNotificationToOwner(`Feature completed: ${pr.title}`);
}
```

### 3. Squash Merge Format

Commit message from PR review agent approval:

```
feat: add dark mode toggle

Implements dark mode with system preference detection and manual toggle.
Changes:
- Add theme context provider
- Implement toggle in settings
- Update all components for theme support

Closes #123

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### 4. Merge Success Notification with Revert

After successful merge, admin receives a notification with revert option:

```typescript
// Send merge success notification with Revert button
await sendNotificationToOwner(
  `✅ PR Merged Successfully\n\n📝 PR: #${prNumber}\n🔗 Issue: #${issueNumber}`,
  'agent',
  {
    inline_keyboard: [
      [
        { text: '📄 View PR', url: prUrl },
        { text: '📋 View Issue', url: issueUrl }
      ],
      [
        { text: '↩️ Revert', callback_data: `rv:${issueNumber}:${prNumber}:${shortSha}:${prevStatus}:${phase}` }
      ]
    ]
  }
);
```

**Callback Data Format:**
- `rv:` - Revert action prefix
- `issueNumber` - Related issue number
- `prNumber` - Merged PR number
- `shortSha` - First 7 chars of merge commit SHA
- `prevStatus` - Status before merge (e.g., `impl` for implementation)
- `phase` - Phase info for multi-phase features (e.g., `1/3` or `_` for single)

### 5. Revert Handler

When admin clicks Revert:

```typescript
if (action.startsWith('rv:')) {
  // 1. Parse callback data
  const [, issueNumber, prNumber, sha, prevStatus, phase] = action.split(':');

  // 2. Create revert PR (doesn't push directly to main)
  const revertResult = await adapter.createRevertPR(
    mergeCommitSha,
    parseInt(prNumber),
    parseInt(issueNumber)
  );

  // 3. Restore workflow status
  await adapter.updateStatus(projectItemId, STATUSES.implementation);
  await adapter.updateReviewStatus(projectItemId, REVIEW_STATUSES.requestChanges);

  // If multi-phase, restore phase counter
  if (phase !== '_') {
    await adapter.updateImplementationPhase(projectItemId, phase);
  }

  // 4. Send confirmation with Merge Revert PR button
  await sendNotificationToOwner(
    `↩️ Merge Reverted\n\nRevert PR: #${revertResult.prNumber}\nStatus: Implementation with Request Changes`,
    'agent',
    {
      inline_keyboard: [
        [{ text: '✅ Merge Revert PR', callback_data: `merge_rv:${issueNumber}:${revertResult.prNumber}` }],
        [{ text: '📄 View Revert PR', url: revertResult.url }]
      ]
    }
  );
}
```

### 6. Merge Revert PR Handler

When admin clicks "Merge Revert PR":

```typescript
if (action.startsWith('merge_rv:')) {
  // 1. Parse callback data
  const [, issueNumber, revertPrNumber] = action.split(':');

  // 2. Merge the revert PR
  await adapter.mergePullRequest(
    parseInt(revertPrNumber),
    `Revert: Revert PR #${originalPrNumber}`,
    `Reverts changes from #${originalPrNumber}`
  );

  // 3. Delete the revert branch
  await adapter.deleteBranch(`revert-pr-${originalPrNumber}`);

  // 4. Send confirmation with next steps
  await sendNotificationToOwner(
    `✅ Revert PR Merged\n\nNext steps:\n1️⃣ Add comment to issue explaining what went wrong\n2️⃣ Run yarn agent:implement`
  );
}
```

### 7. GitHub Action Fallback

Located in: `.github/workflows/pr-merged-mark-done.yml`

Runs on PR merge as backup to webhook:

```yaml
name: Mark Item Done on PR Merge
on:
  pull_request:
    types: [closed]

jobs:
  mark-done:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - name: Extract Item ID
        id: extract
        run: |
          ITEM_ID=$(echo "${{ github.event.pull_request.body }}" | \
            grep -oP '<!-- feature-id: \K[a-f0-9]+' || echo "")
          echo "item_id=$ITEM_ID" >> $GITHUB_OUTPUT

      - name: Mark as Done
        if: steps.extract.outputs.item_id != ''
        run: |
          curl -X POST "${{ secrets.WEBHOOK_URL }}/api/mark-done" \
            -H "Content-Type: application/json" \
            -d '{"itemId": "${{ steps.extract.outputs.item_id }}"}'
```

## Status Update Architecture

### Three-Tier Status System

**Tier 1: Source Collections (High-Level)**
- Stored in: `feature-requests` and `reports` collections
- Used for: Admin dashboard, user-facing status
- Values: `new`, `in_progress`, `done`, `rejected`

**Tier 2: Workflow Items (Pipeline Tracking)**
- Stored in: `workflow-items` collection (recommended, `AppProjectAdapter`)
- Used for: Agent workflow routing, granular tracking
- Values: `backlog`, `productDesign`, `techDesign`, `readyForDev`, `prReview`, `done`

**Tier 3 (Legacy): GitHub Projects V2**
- Stored in: GitHub Projects V2 single-select field (`GitHubProjectsAdapter`)
- Alternative backend for pipeline tracking
- Same values as Tier 2, stored externally

### Status Synchronization

```typescript
// Source collection status determines which workflow pipeline phase to use
const statusMap = {
  pending: null,              // Not yet in GitHub
  approved: 'backlog',        // Initial phase after approval
  'in-progress': [            // Can be in any active phase
    'productDesign',
    'techDesign',
    'readyForDev',
    'prReview'
  ],
  done: 'done'               // Terminal state
};
```

### Status Update Flow

```typescript
async function updateItemStatus(itemId: string, workflowStatus: ProjectStatus) {
  // 1. Update workflow item (via adapter)
  await adapter.updateStatus(item.projectItemId, workflowStatus);

  // 2. Derive source collection status
  const sourceStatus = deriveSourceStatus(workflowStatus);

  // 3. Update source collection
  await db.features.updateStatus(itemId, sourceStatus);

  // 4. Notify admin if status changed
  if (statusChanged) {
    await sendNotificationToOwner(`Status: ${item.title} → ${githubStatus}`);
  }
}

function deriveMongoStatus(githubStatus: ProjectStatus): FeatureStatus {
  switch (githubStatus) {
    case 'backlog':
    case 'productDesign':
    case 'techDesign':
    case 'readyForDev':
    case 'prReview':
      return 'in-progress';
    case 'done':
      return 'done';
    default:
      return 'approved';
  }
}
```

### Status Transitions

Valid transitions (enforced by adapter):

```
backlog → productDesign → techDesign → readyForDev → prReview → done
   ↓                                        ↑
   └────────────────────────────────────────┘
   (shortcut for simple items)
```

## Child Project Setup

When using agents in a separate copy of the project:

### 1. Initialize Agents Copy

```bash
# From main project
yarn init-agents-copy

# Creates ../app-template-ai-agents with:
# - Minimal package.json
# - Synced src/agents/ folder
# - Separate .env file
# - Git repository
```

### 2. Environment Variables

Agents copy needs these variables in `.env`:

```bash
# Main project connection
MAIN_PROJECT_PATH=/Users/username/Projects/app-template-ai

# Claude Code SDK (only needed in agents-copy)
ANTHROPIC_API_KEY=sk-ant-xxx

# GitHub (same as main project)
GITHUB_TOKEN=github_pat_xxx
PROJECT_ID=PVT_kwHOABCDEF1234567890

# MongoDB (same as main project)
MONGODB_URI=mongodb+srv://...

# Telegram (optional, for notifications)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
LOCAL_TELEGRAM_CHAT_ID=123456789
```

### 3. Sync Strategy

**Option A: Full Copy (Default)**
```bash
# Copy all files
yarn init-agents-copy
```

**Option B: Symlink Shared Folder**
```bash
# Symlink shared utilities only
yarn init-agents-copy --symlink-shared
```

Symlink benefits:
- Always up-to-date with main project
- No need to re-sync after changes

Symlink drawbacks:
- Requires file system support for symlinks
- Can't modify shared files independently

### 4. Running Agents

```bash
# From agents copy
cd ../app-template-ai-agents

# Run specific agent
yarn agent:product-design --feature-id <id>
yarn agent:tech-design --feature-id <id>
yarn agent:implement --feature-id <id>

# Run PR review (cron)
yarn agent:pr-review
```

## Environment Variables Reference

### Required (Main Project)

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | Fine-grained token with repo access | `github_pat_xxx` |
| `PROJECT_ID` | GitHub Projects V2 ID | `PVT_kwHOABCDEF1234567890` |
| `BACKLOG_STATUS` | Backlog column option ID | `f_abc123` |
| `PRODUCT_DESIGN_STATUS` | Product Design column option ID | `f_def456` |
| `TECH_DESIGN_STATUS` | Tech Design column option ID | `f_ghi789` |
| `READY_FOR_DEV_STATUS` | Ready for Dev column option ID | `f_jkl012` |
| `PR_REVIEW_STATUS` | PR Review column option ID | `f_mno345` |
| `DONE_STATUS` | Done column option ID | `f_pqr678` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | `123456789:ABC...` |
| `LOCAL_TELEGRAM_CHAT_ID` | Admin's Telegram chat ID | `123456789` |

### Required (Agents Copy)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for SDK |
| `MAIN_PROJECT_PATH` | Path to main project |
| All GitHub variables | Same as main project |
| All Telegram variables | Same as main project |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_LIBRARY` | Default agent library | `claude-code-sdk` |
| `AGENT_TELEGRAM_CHAT_ID` | Separate chat for agent logs | `LOCAL_TELEGRAM_CHAT_ID` |
| `GITHUB_TELEGRAM_CHAT_ID` | Separate chat for GitHub events | `LOCAL_TELEGRAM_CHAT_ID` |
| `VERCEL_TELEGRAM_CHAT_ID` | Separate chat for deployments | `LOCAL_TELEGRAM_CHAT_ID` |

## API Endpoints

### Internal APIs (Next.js)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/telegram-webhook` | POST | Handle Telegram callbacks |
| `/api/github-webhook` | POST | Handle GitHub events |
| `/api/cron/pr-review` | GET | Scheduled PR reviews |
| `/api/process/features_create` | POST | Create feature request |
| `/api/process/features_approve` | POST | Approve feature |
| `/api/process/features_route` | POST | Route feature to phase |
| `/api/process/bugs_create` | POST | Create bug report |
| `/api/process/bugs_approve` | POST | Approve bug |

### External APIs Used

**GitHub GraphQL API** (`https://api.github.com/graphql`)
- Create issues
- Add to projects
- Update project fields
- Query project items

**GitHub REST API** (`https://api.github.com`)
- Merge pull requests
- Get PR comments
- Create PR comments
- Get PR files

**Telegram Bot API** (`https://api.telegram.org/bot<token>`)
- Send messages
- Send inline keyboards
- Edit messages
- Set webhook

## Security Considerations

1. **GitHub Token Scope:**
   - Use fine-grained tokens (not classic)
   - Limit to specific repositories
   - Set expiration (90 days max)
   - Rotate regularly

2. **Telegram Webhook:**
   - Validate callback data format
   - Check user authorization
   - Rate limit requests
   - Log all actions

3. **Environment Variables:**
   - Never commit tokens to git
   - Use Vercel environment variables
   - Separate dev/prod configurations
   - Verify before deployment

4. **MongoDB Access:**
   - Validate all IDs
   - Use ObjectId type checking
   - Sanitize user input
   - Limit query results

5. **Agent Execution:**
   - Run in separate project (isolation)
   - Limit API usage
   - Log all operations
   - Handle errors gracefully
