# GitHub Projects Integration

This document describes the GitHub Projects integration that automates the **feature request AND bug report workflow** from initial submission to merged PRs.

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
6. **AI agent generates design/implementation** → sets Review Status = "Waiting for Review"
7. **Admin approves** (via Telegram button) → auto-advances to next phase
8. **Admin merges PR** → GitHub Action marks item as Done

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

## MongoDB Status vs GitHub Project Status

The system uses a **two-tier status tracking** approach to eliminate duplication:

### MongoDB Statuses (4 values)

**Feature Requests:**
| Status | Meaning |
|--------|---------|
| `new` | Feature request submitted, not yet synced to GitHub |
| `in_progress` | Synced to GitHub (detailed status tracked in GitHub Projects) |
| `done` | Completed and merged |
| `rejected` | Not going to implement |

**Bug Reports:**
| Status | Meaning |
|--------|---------|
| `new` | Bug report submitted, not yet synced to GitHub |
| `investigating` | Synced to GitHub (detailed status tracked in GitHub Projects) |
| `resolved` | Fixed and merged |
| `closed` | Won't fix, duplicate, or not a bug |

### GitHub Project Statuses (6 values)
| Status | Meaning |
|--------|---------|
| `Backlog` | New items, not yet started |
| `Product Design` | AI generates product design, human reviews |
| `Technical Design` | AI generates tech design, human reviews |
| `Ready for development` | AI implements feature |
| `PR Review` | PR created, waiting for human review/merge |
| `Done` | Completed and merged |

**Why this split?**
- **MongoDB**: Tracks approval state and lifecycle (new → in progress → done) + stores rich diagnostics for bugs
- **GitHub Projects**: Tracks detailed workflow steps (Product Design → Tech Design → Ready for development → etc.)
- **No duplication**: When an item is "in_progress"/"investigating" in MongoDB, you check GitHub Projects for the detailed status
- **UI displays GitHub status**: The app UI shows GitHub Project status for synced items, MongoDB status for `new`/`done`/`rejected`
- **Separate collections**: Bug reports need session logs, screenshots, performance data - features don't

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
│  │ ├── prompts.ts        # Prompt templates                         │  │
│  │ └── types.ts          # Agent-specific types                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## GitHub Project Setup

### Step 1: Create the GitHub Project

1. Go to `https://github.com/users/{your-username}/projects`
2. Click "New project"
3. Select "Board" view
4. Name it appropriately (e.g., "Feature Pipeline")

### Step 2: Configure Status Column

The project uses a 6-column workflow. Create a Status field with these exact values:

| Status | Description |
|--------|-------------|
| `Backlog` | New items, not yet started |
| `Product Design` | AI generates product design, human reviews |
| `Technical Design` | AI generates tech design, human reviews |
| `Ready for development` | AI implements feature (picked up by implement agent) |
| `PR Review` | PR created, waiting for human review/merge |
| `Done` | Completed and merged |

**How it works**: Each phase uses the Review Status field to track sub-states within that phase (see below). The implement agent automatically moves items from "Ready for development" to "PR Review" after creating a PR.

### Step 3: Create Review Status Custom Field

1. In your project, click the "+" button to add a field
2. Select "Single select"
3. Name it exactly: `Review Status`
4. Add these options:
   - `Waiting for Review`
   - `Approved`
   - `Request Changes`
   - `Rejected`

**Review Status meanings within each phase:**

| Review Status | Meaning |
|---------------|---------|
| *(empty)* | Ready for AI agent to process |
| `Waiting for Review` | AI finished, human needs to review |
| `Approved` | Human approved, ready to advance to next phase (auto-advances) |
| `Request Changes` | Human wants revisions, AI will address feedback |
| `Rejected` | Won't proceed with this item |

This allows each phase to have its own lifecycle (AI work → Human review → Approved/Rejected) without needing separate board columns.

## Environment Setup

### Required Environment Variables

The system uses **two separate GitHub tokens** for clear separation of concerns:

```bash
# Admin token (your personal token) - for GitHub Projects operations
GITHUB_TOKEN=ghp_your_admin_token_here

# Bot token (bot account token) - for PRs, issues, and comments
GITHUB_BOT_TOKEN=ghp_your_bot_token_here

# Telegram bot token for notifications (optional but recommended)
TELEGRAM_BOT_TOKEN=xxxxxxxxxxxxx
```

**Why Two Tokens?**

| Token | Used For | Who It Appears As |
|-------|----------|-------------------|
| `GITHUB_TOKEN` (admin) | GitHub Projects queries, project status updates, **PR reviews** | Your personal account (reviews), not visible (projects) |
| `GITHUB_BOT_TOKEN` (bot) | Creating PRs, issues, comments | `dev-agent-bot` (or your bot account name) |

**Token Usage Details:**

| Operation | Token Used | Reason |
|-----------|------------|--------|
| Read/write GitHub Projects | `GITHUB_TOKEN` (admin) | Admin has project access |
| Create issues | `GITHUB_BOT_TOKEN` (bot) | Issues appear from bot |
| Update issue body | `GITHUB_BOT_TOKEN` (bot) | Updates appear from bot |
| Post issue comments | `GITHUB_BOT_TOKEN` (bot) | Comments appear from bot |
| Create PRs | `GITHUB_BOT_TOKEN` (bot) | PRs created by bot |
| **Submit PR reviews (approve/request changes)** | `GITHUB_TOKEN` (admin) | **Admin reviews bot's PRs** |
| Post PR comments | `GITHUB_BOT_TOKEN` (bot) | Comments appear from bot |

**Benefits:**
- ✅ No need to add bot account to GitHub Project (admin already has access)
- ✅ Clear separation: visible actions = bot, data access = admin
- ✅ **You can approve PRs created by bot** (GitHub doesn't allow self-approval)
- ✅ Easy to identify bot vs human actions

**Important:** If `GITHUB_BOT_TOKEN` is not set, the system falls back to using `GITHUB_TOKEN` with a warning. In this mode, **you cannot approve your own PRs** because they'll be created by your account.

### Getting GitHub Tokens

**Admin Token (GITHUB_TOKEN):**

1. Use your personal GitHub account
2. Go to Settings → Developer settings → Personal access tokens
3. Generate new token with scopes:
   - `repo` - Full control of private repositories
   - `project` - Full control of projects
4. Copy to `.env` as `GITHUB_TOKEN`

**Bot Token (GITHUB_BOT_TOKEN):**

See the "Bot Account Setup" section below for complete instructions on creating a bot account and generating its token.

### Bot Account Setup (Recommended)

**Why you need a bot account:**

When agents use your personal GitHub token:
- ❌ You **cannot approve PRs** created by agents (GitHub doesn't allow PR authors to approve their own PRs)
- ❌ You **cannot differentiate** between your comments and agent comments
- ❌ All agent actions appear as if **you** took them

**Solution:** Create a separate bot GitHub account for agents.

**Step-by-Step Setup:**

**Step 1: Create Bot GitHub Account**

Use Gmail's +alias feature to avoid needing a new email:

1. If your email is `yourname@gmail.com`, use `yourname+bot@gmail.com`
2. Go to https://github.com/signup
3. Sign up with `yourname+bot@gmail.com`
4. Choose a username like `yourname-bot` or `dev-agent-bot`
5. Verify the email (Gmail delivers to your main inbox)

**Step 2: Add Bot as Collaborator**

1. Go to your repository → Settings → Collaborators
2. Add the bot account as a collaborator
3. Accept the invitation from the bot account

**Step 3: Generate Bot Token**

1. Log in to the bot account
2. Go to Settings → Developer settings → Personal access tokens
3. Generate new token with scopes: `repo`, `project`
4. Copy the token

**Step 4: Update Local Environment**

Add the bot token to your `.env.local` (keep your admin token too):
```bash
# Admin token (your personal account) - for GitHub Projects
GITHUB_TOKEN="ghp_your_admin_token_here"

# Bot token (bot account) - for PRs, issues, comments
GITHUB_BOT_TOKEN="ghp_bot_token_here"
```

**Step 5: Update Vercel Production**

Push both tokens to Vercel:
```bash
# Create temporary file with both tokens
cat > .env.github << 'EOF'
GITHUB_TOKEN="ghp_your_admin_token_here"
GITHUB_BOT_TOKEN="ghp_bot_token_here"
EOF

# Push to Vercel production
yarn vercel-cli env:push --file .env.github --target production --overwrite

# Verify both tokens are set
yarn vercel-cli env --target production | grep GITHUB

# Clean up temporary file
rm .env.github

# Redeploy to pick up new tokens
git commit --allow-empty -m "chore: update to two-token architecture"
git push
```

**Step 6: Update GitHub Actions**

GitHub Actions needs the bot token since it posts comments and updates issues.

Use the automated setup script (reads from `.env.local`):
```bash
# Requires: gh CLI installed and authenticated
# Updates GITHUB_TOKEN secret with bot token automatically
yarn setup-github-secrets
```

Or manually update repository secrets (Settings → Secrets and variables → Actions):
- `GITHUB_TOKEN`: Set to **bot account token** (for posting comments, marking items done)

**Note:** GitHub Actions only needs the bot token, not the admin token. The admin token stays local and in Vercel for project operations.

**Step 7: Verify Setup**

Test by creating a comment:
```bash
yarn github-pr comment --pr <pr-number> --message "Test from bot"
```

Check that the comment appears from the bot account, not your personal account.

**Result:**
- ✅ All PRs created by `bot-account` (not you)
- ✅ You can approve/request changes on PRs
- ✅ Clear separation between user and agent actions
- ✅ Agent identity prefixes show which specific agent took each action

### Agent Identity Prefixes

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

### Telegram Setup

1. See [docs/telegram-notifications.md](./telegram-notifications.md) for bot setup
2. Set `ownerTelegramChatId` in `src/app.config.js` for admin notifications

## Configuration

Project configuration is controlled via environment variables:

```bash
# Required
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Optional (defaults shown)
GITHUB_OWNER=gileck
GITHUB_REPO=app-template-ai
GITHUB_PROJECT_NUMBER=3
GITHUB_OWNER_TYPE=user  # 'user' or 'org'
```

Agent-specific configuration (Claude model, timeout) is in `src/agents/shared/config.ts`:

```typescript
export const agentConfig: AgentConfig = {
    telegram: {
        enabled: true,
    },
    claude: {
        model: 'sonnet',
        maxTurns: 100,
        timeoutSeconds: 600,
    },
};
```

**Note:** The status values in `STATUSES` and `REVIEW_STATUSES` are constants defined in `src/server/project-management/config.ts` and should NOT be modified.

### Project Management Adapter

The GitHub API logic uses an adapter pattern for flexibility. Both the server (app UI) and CLI agents share the same adapter:

**File:** `src/server/project-management/`

```typescript
import { getProjectManagementAdapter, STATUSES, REVIEW_STATUSES } from '@/server/project-management';

// Initialize and use the adapter
const adapter = getProjectManagementAdapter();
await adapter.init();

// Get available statuses
const statuses = await adapter.getAvailableStatuses();
const reviewStatuses = await adapter.getAvailableReviewStatuses();

// Update project item status
await adapter.updateItemStatus(itemId, STATUSES.productDesign);
await adapter.updateItemReviewStatus(itemId, REVIEW_STATUSES.waitingForReview);

// Fetch project item details
const item = await adapter.getItem(itemId);
```

The adapter uses a singleton pattern and caches project metadata (field IDs, status options) after initialization to minimize API calls.

**Key interface methods:**
| Method | Description |
|--------|-------------|
| `init()` | Initialize the adapter (authenticate, fetch metadata) |
| `getAvailableStatuses()` | Returns available main statuses |
| `getAvailableReviewStatuses()` | Returns available review statuses |
| `listItems(options)` | List project items with optional filters |
| `getItem(itemId)` | Fetch item with status and review status |
| `updateItemStatus()` | Update main status |
| `updateItemReviewStatus()` | Update review status |
| `createIssue()` | Create a new issue |
| `addIssueToProject()` | Add an issue to the project |
| `createPullRequest()` | Create a PR |

## Unified Approval & Routing Flow

The system handles both **feature requests** and **bug reports** through the same approval and routing workflow:

### Step 1: User Submission

**Feature Request:**
- User submits via FeatureRequestDialog
- Stored in `feature-requests` collection with status=`new`

**Bug Report:**
- User submits via BugReportDialog (includes screenshot, session logs)
- Stored in `reports` collection with status=`new`
- Rich diagnostics captured: session logs, stack traces, browser info, performance data

### Step 2: Admin Approval (Telegram Quick-Approve)

When a submission arrives:
1. Admin receives a Telegram notification with details
2. The notification includes an inline "Approve & Create GitHub Issue" button
3. Tapping the button:
   - Creates GitHub issue (labeled `feature-request` or `bug`)
   - Adds to GitHub Project in "Backlog" status
   - Updates MongoDB status to `in_progress`/`investigating`
   - Sends **routing notification** (see Step 3)

**Telegram Notification Examples:**

*Feature Request:*
```
✨ New Feature Request!

📋 Add dark mode toggle
🟡 Priority: medium

Users have requested a dark mode option...

[✅ Approve & Create GitHub Issue]  ← inline callback button
```

*Bug Report:*
```
🐛 New Bug Report!

📋 Login form crashes on submit

📍 Route: /login
👤 Reported by: john_doe

[✅ Approve & Create GitHub Issue]  ← inline callback button
```

The approval uses a secure token that:
- Is unique to each submission
- Can only be used once
- Is cleared after approval

**Note:** For localhost development (HTTP), a text link is shown instead since Telegram callback buttons require HTTPS.

### Step 3: Admin Routing (Choose Starting Phase)

After approval, admin receives a **routing notification** asking where the item should start:

```
✨ Feature Request Synced to GitHub!
  (or: 🐛 Bug Synced to GitHub!)

📋 Add dark mode toggle
🟡 Priority: medium
🔗 Issue #123

Where should this feature start?

• Product Design - Needs UX/UI design
• Tech Design - Needs architecture planning
• Ready for development - Simple feature, go straight to coding
• Backlog - Keep in backlog for now

[🎨 Product Design] [🔧 Tech Design]
[⚡ Ready for development] [📋 Keep in Backlog]
[🔗 View Issue]
```

Admin taps a routing button to select the starting phase. The item is moved to that column in GitHub Projects.

**Routing Guidelines:**

| Item Type | Recommended Route |
|-----------|-------------------|
| Complex feature needing UX | Product Design |
| Complex bug needing redesign | Product Design |
| Feature needing architecture | Tech Design |
| Bug needing root cause analysis | Tech Design |
| Simple feature | Ready for development |
| Simple bug fix | Ready for development |
| Not ready to start | Backlog |

### Step 4: AI Agent Processing

Once routed, the appropriate AI agent picks up the item:

**Product Design Agent:**
- Generates UX/UI design document
- Posts high-level summary comment on GitHub issue (e.g., "Here's the design overview: 1. ... 2. ... 3. ...")
- Sends Telegram notification with summary
- **Note:** Bugs are skipped by default (most bugs don't need product design)
- If a bug needs product design, admin manually routes it there

**Tech Design Agent:**
- **For features:** Generates technical architecture
- **For bugs:** Loads diagnostics (session logs, stack traces) and generates root cause analysis + fix approach
- Posts high-level implementation plan comment on GitHub issue (e.g., "Here's the implementation plan: 1. ... 2. ... 3. ...")
- Sends Telegram notification with summary
- Bug prompts include full diagnostic data (NOT shown in GitHub issue)

**Implementation Agent:**
- **For features:** Creates `feature/issue-#-title` branch, PR title: `feat: ...`
- **For bugs:** Creates `fix/issue-#-title` branch, PR title: `fix: ...`
- Posts high-level summary comment on PR (e.g., "Here's what I did: 1. ... 2. ... 3. ...")
- Sends Telegram notification with summary
- Bug implementation prompts include session logs and diagnostics

**Feedback Mode:**
When addressing review feedback, agents post "Here's what I changed: 1. ... 2. ... 3. ..." instead of "Here's what I did/designed"

### Alternative: App UI Approval

Admins can also approve via the admin panel UI:
1. Go to `/admin/reports` (bugs) or `/admin/feature-requests` (features)
2. Click **Approve** button
3. Same workflow as Telegram approval (creates issue, sends routing notification)

**Note:** MongoDB only tracks high-level status (`new`, `in_progress`, `done`, `rejected` for features; `new`, `investigating`, `resolved`, `closed` for bugs). Detailed workflow tracking happens in GitHub Projects.

## GitHub Notifications (Telegram)

The repository includes GitHub Actions workflows that send Telegram notifications for:

- **Issues**: Created, closed, reopened, labeled, assigned
- **Comments**: New comments on issues
- **Project Status**: Items added, status changed, removed
- **Pull Requests**: Opened, merged, closed, review requested
- **PR Reviews**: Approved, changes requested, comments

### Setup

**Option 1: Automatic (Recommended)**

Run the setup script to configure all secrets and variables at once:

```bash
yarn setup-github-secrets
```

This requires:
- GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
- `.env` file with `TELEGRAM_BOT_TOKEN` and `LOCAL_TELEGRAM_CHAT_ID`

**Option 2: Manual**

1. **Add Repository Secrets** (Settings → Secrets and variables → Actions):
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
   - `TELEGRAM_CHAT_ID`: Your Telegram chat ID (get via `yarn telegram-setup`)

2. **Add Repository Variable** (Settings → Secrets and variables → Actions → Variables):
   - `TELEGRAM_NOTIFICATIONS_ENABLED`: Set to `true` to enable notifications

**Additional Setup (for project status notifications):**

3. **Enable Projects V2 Permissions**:
   - Go to Settings → Actions → General
   - Under "Workflow permissions", select "Read and write permissions"

### Workflow Files

| File | Events | Description |
|------|--------|-------------|
| `.github/workflows/issue-notifications.yml` | Issues, comments | Telegram notifications for issue events |
| `.github/workflows/pr-notifications.yml` | Pull requests, reviews | Telegram notifications for PR events |
| `.github/workflows/pr-merged-mark-done.yml` | PR merged | Auto-marks issue as Done when PR merges |
| `.github/workflows/deploy-notify.yml` | Deployments | Deployment notifications |
| `.github/workflows/pr-checks.yml` | PR opened/updated | Run checks on PRs |
| `.github/workflows/claude-code-review.yml` | PR opened/updated | Automated Claude Code PR review |
| `.github/workflows/claude.yml` | @claude mentions | Claude Code integration on-demand |

**Claude Code Workflows:**

The repository includes two Claude Code GitHub Actions workflows for AI-assisted development:

1. **`claude-code-review.yml`** - Automated PR Reviews
   - Triggers on PR opened, updated, or reopened
   - Uses Claude Code's code-review plugin
   - Provides automated code review feedback
   - Requires `CLAUDE_CODE_OAUTH_TOKEN` secret

2. **`claude.yml`** - On-Demand Claude Code
   - Triggers when `@claude` is mentioned in:
     - Issue comments
     - PR review comments
     - Issue titles or bodies
     - PR review bodies
   - Runs Claude Code to perform requested actions
   - Requires `CLAUDE_CODE_OAUTH_TOKEN` secret

**Setup:**
Add the `CLAUDE_CODE_OAUTH_TOKEN` secret to your repository:
1. Go to https://code.claude.com/settings/tokens
2. Generate a new OAuth token
3. Add to GitHub: Settings → Secrets and variables → Actions → New repository secret
4. Name: `CLAUDE_CODE_OAUTH_TOKEN`

> **Note:** Project-level webhooks (`projects_v2_item` events) don't work for user-owned projects due to GitHub limitations. The auto-advance functionality is handled by `yarn github-workflows-agent --auto-advance` instead.

### Notification Examples

**Issue Created:**
```
🆕 New Issue #123

Add dark mode toggle

👤 by username
🔗 https://github.com/...
```

**Status Changed:**
```
📊 Status Changed

#123: Add dark mode toggle

➡️ Product Design
👤 by admin
🔗 https://github.com/...
```

**PR Merged:**
```
🎉 PR #456 Merged

feat: Add dark mode toggle

👤 by admin
🔗 https://github.com/...
```

### Disabling Notifications

Set the `TELEGRAM_NOTIFICATIONS_ENABLED` variable to `false` or delete it to disable all notifications.

### Auto-Advance on Approval

The `--auto-advance` flag (or `yarn github-workflows-agent --auto-advance`) automatically advances items to the next phase when Review Status = "Approved".

**Transitions:**
| Current Status | On Approval → | Next Status |
|----------------|---------------|-------------|
| Product Design | → | Technical Design |
| Technical Design | → | Ready for development |
| Ready for development | (no auto-advance) | Manual PR merge required → Done |

**Example workflow:**
1. AI agent generates Product Design, sets Review Status = "Waiting for Review"
2. You receive Telegram notification with Approve/Request Changes buttons
3. You tap "Approve" (or set Review Status = "Approved" in GitHub)
4. Run `yarn github-workflows-agent --auto-advance` (or `--all`)
5. Item moves to "Technical Design" and Review Status is cleared
6. AI agent can now pick it up for Technical Design generation

**Usage:**
```bash
# Run auto-advance only
yarn github-workflows-agent --auto-advance

# Run as part of full workflow (auto-advance runs first)
yarn github-workflows-agent --all
```

> **Note:** GitHub Actions webhooks for project events (`projects_v2_item`) don't work for user-owned projects due to GitHub limitations. That's why auto-advance is handled via CLI instead of GitHub Actions.

## Viewing GitHub Status in the App

The app UI displays live GitHub Project status for feature requests that have been synced to GitHub.

### What's Displayed

When you expand a feature request card in the admin panel, you'll see:
- **GitHub Issue Link**: Click to view the issue on GitHub
- **GitHub PR Link**: Click to view the PR (when created)
- **Project Status**: The current status in GitHub Projects (e.g., "Product Design")
- **Review Status**: The current review status (e.g., "Waiting for Review")

### How It Works

The status is fetched **directly from GitHub API** in real-time:
1. When you expand a feature request card, it fetches the current status from GitHub
2. Status refreshes automatically when the window regains focus
3. Data is considered stale after 30 seconds

This approach ensures you always see the **actual current status** from GitHub, not a cached copy in the database.

### Updating GitHub Status from the App

Admins can change the GitHub Project status directly from the Feature Requests UI without leaving the app:

1. Open the Feature Requests page in the admin panel
2. Find a request that's linked to GitHub (has an issue link)
3. Click the **three-dot menu** (⋮) on the card
4. Select **GitHub Status** submenu
5. Choose the new status from the list

The status updates immediately in GitHub Projects, and the card refreshes to show the new status.

**Available statuses:**
- Backlog
- Product Design
- Technical Design
- Ready for development
- Done

**Note:** The "GitHub Status" menu option only appears for requests that have been synced to GitHub (i.e., have a `githubProjectItemId`).

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `feature-requests/github-status` | Fetch current status for a request |
| `feature-requests/github-statuses` | Get all available status options |
| `admin/feature-requests/update-github-status` | Update status (admin only) |

All endpoints require authentication. The update endpoint is admin-only.

## Workflow Guide

### Complete Workflow

```
Feature Request Submitted
         │
         ▼
    ┌─────────────────────────────────────┐
    │ MongoDB: 'new'                      │
    │ (Not yet synced to GitHub)          │
    └─────────────────┬───────────────────┘
                      │
         ├────────────┴──────────────────────┐
         │                                   │
         ▼                                   ▼
    ┌────────────────────┐      ┌─────────────────────────┐
    │ Telegram           │      │ Admin Panel             │
    │ Notification       │      │ "Approve" Button        │
    │ + Approve Button   │      │                         │
    └─────────┬──────────┘      └───────────┬─────────────┘
              │                              │
              └──────────┬───────────────────┘
                         │
                         ▼ (Admin approves - creates GitHub issue)
    ┌─────────────────────────────────────────────────────────┐
    │ GitHub Issue Created                                    │
    │ GitHub Status: Product Design                           │
    │ GitHub Review Status: (empty)                           │
    │ MongoDB: 'in_progress' ← stays here through all phases  │
    └─────────────────────┬───────────────────────────────────┘
                          │
                          ▼ yarn agent:product-design
    ┌─────────────────────────────────────┐
    │ GitHub Status: Product Design       │
    │ Review Status: Waiting for Review   │
    │ (Issue body updated with design)    │
    │ MongoDB: 'in_progress' (unchanged)  │
    └─────────────────┬───────────────────┘
                      │
              ┌───────┴───────┐
              ▼               ▼
         Approved        Request Changes
              │               │
              │               ▼ yarn agent:product-design
              │           (Revises design)
              │               │
              └───────┬───────┘
                      │
                      ▼ (Auto-advances to Technical Design)
    ┌─────────────────────────────────────┐
    │ GitHub Status: Technical Design     │
    │ Review Status: (empty)              │
    │ MongoDB: 'in_progress' (unchanged)  │
    └─────────────────┬───────────────────┘
                      │
                      ▼ yarn agent:tech-design
    ┌─────────────────────────────────────┐
    │ GitHub Status: Technical Design     │
    │ Review Status: Waiting for Review   │
    │ (Issue body updated with design)    │
    │ MongoDB: 'in_progress' (unchanged)  │
    └─────────────────┬───────────────────┘
                      │
              ┌───────┴───────┐
              ▼               ▼
         Approved        Request Changes
              │               │
              │               ▼ yarn agent:tech-design
              │           (Revises design)
              │               │
              └───────┬───────┘
                      │
                      ▼ (Auto-advances to Ready for development)
    ┌─────────────────────────────────────┐
    │ GitHub Status: Ready for development│
    │ Review Status: (empty)              │
    │ MongoDB: 'in_progress' (unchanged)  │
    └─────────────────┬───────────────────┘
                      │
                      ▼ yarn agent:implement
    ┌─────────────────────────────────────┐
    │ GitHub Status: PR Review            │  ← Agent moves here after creating PR
    │ Review Status: Waiting for Review   │
    │ (PR created, branch pushed)         │
    │ MongoDB: 'in_progress' (unchanged)  │
    └─────────────────┬───────────────────┘
                      │
              ┌───────┴───────┐
              ▼               ▼
         Approved        Request Changes
         (Merge PR)           │
              │               ▼ yarn agent:implement
              │           (Addresses feedback, stays in PR Review)
              │               │
              └───────┬───────┘
                      │
                      ▼ (Admin merges PR → GitHub Action automatically marks Done)
    ┌─────────────────────────────────────────────────────────┐
    │ GitHub Status: Done                                     │
    │ MongoDB: 'done' ← auto-updated by GitHub Action         │
    │ (PR merged, auto-completed in both systems)             │
    └─────────────────────────────────────────────────────────┘
```

**Key Points:**
- **MongoDB status** stays `'in_progress'` throughout the entire workflow (Product Design → Tech Design → Ready for development → PR Review)
- **Detailed workflow tracking** happens in GitHub Projects (Product Design, Technical Design, etc.)
- **GitHub Action auto-completion**: When PR is merged, the action automatically:
  - Extracts the issue number from the PR body (e.g., "Closes #123")
  - Updates GitHub Project item status to "Done"
  - Updates MongoDB feature request status to `'done'`
  - Sends a Telegram notification confirming completion

### Admin Actions

Admins can approve/reject via Telegram buttons, GitHub Projects directly, or the app UI (via the three-dot menu > "GitHub Status").

**Telegram Quick Actions** (Recommended):
- All "Waiting for Review" notifications have inline buttons: Approve / Request Changes / Reject
- Tapping a button updates GitHub Project immediately via webhook
- For Product Design and Tech Design: "Approve" auto-advances to next phase and clears Review Status

| Phase | Admin Action | Effect |
|-------|--------------|--------|
| (New Request) | Tap "Approve" in Telegram | Creates issue, sets GitHub Status = "Product Design", Review Status = empty, MongoDB = 'in_progress' |
| Product Design | Tap "Approve" in Telegram | GitHub Status → "Technical Design", Review Status → empty, MongoDB unchanged |
| Product Design | Tap "Request Changes" + add comment | Review Status = "Request Changes", agent revises, MongoDB unchanged |
| Technical Design | Tap "Approve" in Telegram | GitHub Status → "Ready for development", Review Status → empty, MongoDB unchanged |
| Technical Design | Tap "Request Changes" + add comment | Review Status = "Request Changes", agent revises, MongoDB unchanged |
| Ready for development | (Agent creates PR automatically) | GitHub Status → "PR Review", Review Status = "Waiting for Review", MongoDB unchanged |
| PR Review | Tap "Approve" in Telegram | Review Status = "Approved" (merge PR manually), MongoDB unchanged |
| PR Review | Tap "Request Changes" + review comments | Agent addresses feedback, stays in PR Review, MongoDB unchanged |
| PR Review | Merge PR on GitHub | GitHub Action auto-marks GitHub Status = "Done" AND MongoDB = 'done' |

**Skipping Phases** (via GitHub Projects or App UI):
| Action | Use Case |
|--------|----------|
| Backlog → Technical Design | Internal/technical work (skip product design) |
| Backlog → Ready for development | Simple fixes (skip both designs) |

### Agent Clarification Flow

When agents encounter ambiguity or missing information, they can ask questions instead of making assumptions.

**Flow:**
1. Agent detects ambiguity while processing (design or implementation)
2. Agent outputs a formatted clarification request with:
   - Context explaining what's unclear
   - Specific question
   - Options with recommendations and tradeoffs
3. System posts question as GitHub issue comment
4. System sets Review Status to "Waiting for Clarification"
5. Admin receives Telegram notification with question preview
6. Admin reads full question on GitHub issue
7. Admin adds comment with answer
8. Admin clicks "✅ Clarification Received" button in Telegram
9. System updates Review Status to "Clarification Received"
10. Agent picks up item on next run, reads clarification, continues work

**Review Status States:**
- `null` → Ready for agent to start fresh
- `Waiting for Clarification` → Agent blocked, needs admin input
- `Clarification Received` → Admin answered, agent should resume
- `Waiting for Review` → Agent done, admin reviews output
- `Approved` → Admin approved, advance to next phase
- `Request Changes` → Admin wants revisions
- `Rejected` → Won't proceed

**Example Clarification:**

```
## Context
The technical design mentions creating a users API and fetching user data on the client side using `useUser(request.requestedBy)`. However, there is no existing users API infrastructure in the codebase, and the existing comment pattern stores `authorName` directly in the database.

## Question
Should I create a full users API infrastructure, or follow the existing comment pattern by storing `requestedByName` in the feature request document?

## Options

✅ Option 1: Add `requestedByName` field (follows existing pattern)
   - Stores username at creation (like comments do)
   - No extra API calls, simpler
   - Follows established codebase patterns
   - More performant (no runtime lookups)

⚠️ Option 2: Create Users API (follows tech design literally)
   - Requires new API infrastructure (`apis/users/`)
   - Adds extra API calls on every render
   - More complex but allows fetching full user data
   - Username changes would auto-update

## Recommendation
I recommend Option 1 because it's simpler, more performant, and follows the established pattern already used for comments. The username is unlikely to change frequently enough to warrant the added complexity of a users API.

## How to Respond
Please respond with one of:
- "Option 1" (with optional modifications: "Option 1, but also add X")
- "Option 2" (with optional modifications)
- "New Option: [describe completely new approach]"
```

**Admin Response Examples:**
- "Option 1" → Agent proceeds with Option 1 as described
- "Option 1, but fetch user from database on backend instead of frontend" → Agent uses Option 1 approach with specified modification
- "New Option: Store both requestedBy ID and requestedByName, fetch user details on hover" → Agent implements the completely new approach

### Alternative Workflows (Non-Product Features)

Not all work requires a product design phase. For internal implementations, architecture changes, refactoring, or bug fixes, you can skip phases:

**Skip Product Design (Backlog → Technical Design → Ready for development):**
- Architecture changes
- Internal refactoring
- Performance improvements
- Technical debt cleanup
- Infrastructure work

**Skip Both Designs (Backlog → Ready for development):**
- Simple bug fixes
- Config changes
- Dependency updates
- Very small changes with clear implementation

**How to skip phases:**
Simply move the issue directly to the appropriate column in GitHub Projects:

```
# Skip Product Design
Backlog → Technical Design    (admin moves manually)
         ↓
         yarn github-workflows-agent --tech-design
         ↓
Technical Design → Ready for development (via auto-advance on approval)
         ↓
         yarn github-workflows-agent --implement

# Skip Both Designs
Backlog → Ready for development      (admin moves manually)
         ↓
         yarn github-workflows-agent --implement
```

The agents only process items in their specific status column, so skipping phases works automatically.

**Tip:** Add a label like `internal` or `no-product-design` to make it clear why product design was skipped.

### Bug Handling (Type-Aware Agents)

The agents automatically detect whether an issue is a bug or feature based on GitHub labels and adapt their behavior:

**Type Detection:**
```typescript
// In all agents
const issueType = getIssueType(content.labels); // 'bug' or 'feature'
const diagnostics = issueType === 'bug'
    ? await getBugDiagnostics(issueNumber)
    : null;
```

**Product Design Agent:**
- **Skips bugs by default** (most bugs don't need product design)
- Shows: `⚠️ Skipping bug report (bugs typically skip Product Design)`
- If a bug needs UX redesign, admin can manually move it to Product Design

**Tech Design Agent:**
- **For bugs:** Uses bug-specific prompts with diagnostics
  ```
  ## Bug Diagnostics
  Error: Cannot read property 'user' of undefined
  Route: /profile
  Stack Trace: [full trace]
  Session Logs (last 20): [formatted logs]
  Browser: Chrome 120.0 on Windows
  ```
- Generates root cause analysis + fix approach
- **For features:** Uses standard tech design prompts

**Implementation Agent:**
- **For bugs:**
  - Creates `fix/issue-#-title` branch (not `feature/`)
  - PR title: `fix: description` (not `feat:`)
  - Commit message: `fix: description`
  - Prompts include bug diagnostics for context
- **For features:**
  - Creates `feature/issue-#-title` branch
  - PR title: `feat: description`
  - Commit message: `feat: description`

**Bug Diagnostics (NOT in GitHub Issues):**

Bug reports in MongoDB store rich diagnostic data:
- Session logs (last 500 entries)
- Stack traces
- Error messages
- Browser info (user agent, viewport)
- Performance entries
- Screenshot (Vercel Blob URL)

This data is:
- ✅ **Included in agent prompts** (tech design, implementation)
- ❌ **NOT included in GitHub issues** (too verbose)
- ✅ **Stored in MongoDB** `reports` collection

**Example Bug Fix Workflow:**

```
User submits bug → MongoDB: session logs + screenshot
         ↓
Admin approves → GitHub issue created (labeled 'bug')
         ↓
Admin routes → Tech Design
         ↓
Tech Design Agent:
- Loads diagnostics from MongoDB
- Analyzes session logs + stack trace
- Generates root cause analysis + fix approach
         ↓
Admin approves → Ready for development
         ↓
Implementation Agent:
- Loads diagnostics + tech design
- Creates fix/issue-#-description branch
- Implements fix
- Creates PR with title: "fix: description"
         ↓
Admin merges → Done
```

### Pull Request Format (Squash-Merge Ready)

The implement agent creates PRs that are **immediately ready for squash merge** without any editing needed.

**PR Title:**
```
feat: add dark mode toggle    (for features)
fix: resolve login crash      (for bugs)
```
Uses conventional commit format. The agent automatically uses `fix:` for bugs and `feat:` for features.

**PR Body Structure:**

The PR body is divided into two sections by a `---` separator:

**Above `---` (included in squash merge commit):**
```
Implements the feature described in issue #123.

Implementation follows the technical design specifications.
User-facing changes align with product design requirements.

Closes #123
```

**Below `---` (PR metadata only, not included in commit):**
```
---

**Files changed:**
- src/components/Theme.tsx
- src/hooks/useTheme.ts

**Test plan:**
- `yarn checks` passes ✅
- Manual testing completed ✅

See issue #123 for full context, product design, and technical design.

*Generated by Implementation Agent*
```

**When you click "Squash and merge":**
- GitHub uses the PR title as the commit title
- GitHub uses the text above `---` as the commit body
- Everything below `---` is ignored
- Result: A perfect, clean conventional commit without any manual editing

**Auto-completion on merge:**
When you merge the PR, a GitHub Action automatically:
- Extracts the issue number from "Closes #123"
- Updates the project item status to "Done"
- Sends a Telegram notification confirming completion

## Running the Agents

### Master Command (Recommended)

Use `yarn github-workflows-agent` as the single entry point for all agent workflows:

```bash
# Run specific agents
yarn github-workflows-agent --product-design     # Generate product designs
yarn github-workflows-agent --tech-design        # Generate technical designs
yarn github-workflows-agent --implement          # Implement and create PRs
yarn github-workflows-agent --auto-advance       # Auto-advance approved items

# Run all agents in sequence
yarn github-workflows-agent --all                # Runs: auto-advance → product-design → tech-design → implement

# With options
yarn github-workflows-agent --all --dry-run      # Preview all without changes
yarn github-workflows-agent --product-design --id <item-id> --stream
```

The master command delegates to individual scripts and passes through all options.

### Individual Agent Commands

You can also run agents directly if needed:

```bash
yarn agent:product-design                    # Process all pending
yarn agent:tech-design --id <item-id>        # Specific item
yarn agent:implement --dry-run               # Preview
yarn agent:auto-advance                      # Advance approved items
```

> **Note:** GitHub issues are created automatically when you approve a feature request via the app UI or Telegram link. No CLI command is needed for this step.

### Common Options

| Option | Description |
|--------|-------------|
| `--id <id>` | Process a specific item by ID |
| `--limit <n>` | Limit number of items to process |
| `--timeout <s>` | Timeout per item in seconds |
| `--dry-run` | Preview without making changes |
| `--stream` | Stream Claude's output in real-time |
| `--verbose` | Show additional debug output |

### Agents Copy Project (Recommended Setup)

**Why use a separate copy for agents?**

Running agents in your development repository can cause conflicts:
- Agents create branches, commits, and PRs while you're developing
- Your uncommitted work can interfere with agent operations
- Hard to tell which changes are yours vs agent's

**Solution:** Create a dedicated copy for running agents.

**Quick Setup:**

```bash
yarn init-agents-copy
```

This will:
1. Prompt for a location (default: `~/Projects/agents-copy/[REPO_NAME]`)
2. Clone your repository to the new location
3. Install dependencies (`yarn install`)
4. Copy your `.env.local` from the current project
5. Tell you when it's ready

**Example:**
```bash
# In your development repo
cd ~/Projects/my-app
yarn init-agents-copy

# Script creates: ~/Projects/agents-copy/my-app
# Now run agents in the copy:
cd ~/Projects/agents-copy/my-app
yarn github-workflows-agent --all
```

**Workflow:**
- **Development repo** (`~/Projects/my-app`): Your main workspace for coding
- **Agents copy** (`~/Projects/agents-copy/my-app`): Dedicated for agent operations

**Keeping the copy updated:**
```bash
# When you push changes to main, update the agents copy:
cd ~/Projects/agents-copy/my-app
git pull
yarn install  # If package.json changed
```

**Not required but recommended** - You can still run agents in your dev repo if you prefer, just ensure your working directory is clean before running agents.

---

### Running Agents Manually vs Automation

**⚠️ IMPORTANT: Agents are MANUAL-ONLY**

All agents must be manually invoked via CLI commands. There is **no automated scheduling** - agents do not run automatically on timers, webhooks, or status changes.

**To run agents:**
```bash
# Run all agents with one command (recommended)
yarn github-workflows-agent --all

# Or run specific phases
yarn github-workflows-agent --product-design
yarn github-workflows-agent --tech-design
yarn github-workflows-agent --implement
```

**Why manual-only?**
- Cost control: Prevents unexpected AI API usage
- Explicit control: Admin decides when work happens
- Debugging: Easier to troubleshoot when runs are intentional

**Setting up automation (optional):**

If you want automated agent runs, you can set up your own cron job or CI/CD pipeline:

```bash
# Example cron job (runs every 30 minutes)
*/30 * * * * cd /path/to/project && yarn github-workflows-agent --all >> /var/log/agents.log 2>&1
```

Or use GitHub Actions with a schedule trigger:
```yaml
on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
```

**Note:** Without automation, items will remain in their current phase until you manually run the appropriate agent.

### Agent Execution Logs

Every agent execution is automatically logged to a human-readable Markdown file for debugging and auditing purposes.

**What Gets Logged:**

Each log file captures a complete narrative of what happened:
- Full prompts sent to Claude (with all issue details, comments, designs)
- Tool calls (file reads, searches, edits, bash commands)
- Tool outputs (file contents, search results, command output)
- Text responses and thinking blocks from Claude
- GitHub actions taken (comments posted, PRs created, status updates)
- Token usage and costs
- Errors with full context
- Timestamps and durations

**Log File Location:**

```
agent-logs/
├── issue-42.md    # All agents for issue #42
├── issue-43.md    # All agents for issue #43
└── ...
```

**One Log Per Issue:**

All agents working on the same issue append to the same log file, creating a complete chronological narrative:

```markdown
# Issue #42: Add dark mode toggle

## Phase: Product Design
**Agent:** product-design
**Started:** 09:00:00

### Prompt
...full prompt with issue details...

### Agent Execution
**[09:00:05]** 🔧 Tool: Read → src/client/features/theme/store.ts
**[09:00:10]** 📝 Response:
# Product Design: Dark Mode Toggle
...

---

## Phase: Technical Design
**Agent:** tech-design
**Started:** 14:30:00

### Prompt
...full prompt with product design...

### Agent Execution
...
```

**Viewing Logs:**

```bash
# List all logs
yarn agent:logs --list

# View specific issue log
yarn agent:logs --issue 42

# View most recent log
yarn agent:logs --recent

# Or just open the Markdown file directly
cat agent-logs/issue-42.md
```

**Key Features:**

- ✅ Logs are **human-readable Markdown** (open in any editor)
- ✅ **One file per issue** - complete story from Product Design → Implementation
- ✅ **Automatic** - no configuration needed
- ✅ **Gitignored** - logs stay local for privacy
- ✅ Multiple agents on the same issue append chronologically
- ✅ Console output unchanged - logs are additive

**Example Timeline:**

1. **Morning:** Product Design agent runs on issue #42 → creates `issue-42.md`
2. **Evening:** Tech Design agent runs on issue #42 → appends to `issue-42.md`
3. **Next Day:** Implementation agent runs on issue #42 → appends to `issue-42.md`

Result: One complete log file showing the entire journey!

**Use Cases:**

- Debug why an agent made specific decisions
- Review what files the agent examined
- Understand token usage and costs
- Audit agent actions for compliance
- Reproduce agent behavior with same prompts
- Share execution details with team members

## Handling Feedback Loops

### How "Request Changes" Works

1. Admin reviews the design/PR
2. Admin adds comments on the issue explaining what needs to change
3. Admin sets Review Status = "Request Changes"
4. Next time the agent runs, it:
   - Reads the feedback comments
   - Generates a revised version addressing the feedback
   - Updates the issue/PR
   - Sets Review Status back to "Waiting for Review"
5. Admin receives notification that revisions are ready

### PR Review State and Multiple Review Cycles

**Understanding Two Status Systems:**

The system tracks status in two places:
1. **GitHub Projects "Review Status" field** - Tracks workflow state (empty → Waiting for Review → Approved/Request Changes)
2. **GitHub PR review state** - Native GitHub status (Changes requested, Approved, etc.)

**What Happens During Multiple Review Cycles:**

**Round 1:**
1. PR-reviewer submits `REQUEST_CHANGES` review → GitHub PR shows "Changes requested" 🔴
2. Projects Review Status = "Request Changes"

**After implementer addresses feedback:**
3. Implement agent pushes new commits to PR
4. **GitHub behavior**: Old review marked as "outdated" (gray badge), but PR state stays "Changes requested"
5. **Implement agent**: Resets Projects Review Status to "Waiting for Review"

**Round 2 (if changes still insufficient):**
6. PR-reviewer picks up item (Review Status = "Waiting for Review")
7. **PR-reviewer should submit `REQUEST_CHANGES` again** (not `COMMENT`)
8. GitHub creates a **new review entry** applying to the new commits
9. Old review remains in timeline as "outdated"

**Why Always Use REQUEST_CHANGES:**

✅ **Correct approach:**
- Submit `REQUEST_CHANGES` for each review cycle
- Each review formally evaluates the current state of the PR
- Creates clear review timeline showing all iterations
- Old reviews are marked "outdated" automatically
- PR remains properly blocked until approved

❌ **Don't use `COMMENT` event:**
- Using `COMMENT` doesn't formally review the new commits
- Looks like a discussion, not a review decision
- The old "Changes requested" remains the active review
- Doesn't clearly signal that new changes were reviewed and found insufficient

**Example Timeline:**
```
Review 1: REQUEST_CHANGES - "Fix the logic in handleSubmit"
  └─ [outdated] Applied to commit abc123

Commit: "fix: update handleSubmit logic" - def456

Review 2: REQUEST_CHANGES - "Still has XSS vulnerability"
  └─ [current] Applies to commit def456
```

Both reviews use `REQUEST_CHANGES` - this is the correct GitHub PR workflow.

### Writing Effective Review Comments

Good comments are:
- **Specific**: "The database schema should include a `createdAt` field"
- **Actionable**: "Add error handling for the case when user is not found"
- **Clear**: Avoid ambiguous requests

The agent will attempt to address ALL comments in the issue.

## Telegram Notifications

Notifications are sent at each step, all using callback buttons for instant in-Telegram actions:

**New Feature Request:**
```
📝 New Feature Request!

📋 Add dark mode toggle

Users have requested a dark mode option for the app...

📍 Page: Settings

[✅ Approve & Create GitHub Issue]  ← callback button
```

After tapping "Approve", the message updates to:
```
📝 New Feature Request!

📋 Add dark mode toggle
...

✅ Approved
GitHub issue created for "Add dark mode toggle"

🔗 View GitHub Issue
```

**Design Ready for Review:**
```
📝 Product Design Ready for Review!

📋 Add dark mode toggle
🔗 Issue #123
📊 Status: Product Design (Waiting for Review)

Review and approve to proceed to Technical Design.
```

**PR Ready:**
```
🚀 Implementation Complete - PR Ready!

📋 Add dark mode toggle
🔗 Issue #123
🔀 PR #456
📊 Status: PR Review (Waiting for Review)

Review and merge to complete.

[✅ Approve] [📝 Request Changes] [❌ Reject]  ← inline buttons
```

### Telegram Quick Actions (Single Webhook)

All Telegram approval buttons use a single webhook (`/api/telegram-webhook`) for consistent behavior:

**Initial Feature Request Approval:**
- **✅ Approve & Create GitHub Issue** - Creates issue, sets to Product Design status

**Design Review Actions (Product Design / Tech Design / Ready for development):**
- **✅ Approve** - Approves and auto-advances to next phase (clears Review Status)
- **📝 Request Changes** - Sets Review Status to "Request Changes"
- **❌ Reject** - Sets Review Status to "Rejected"

When you tap a button:
1. Telegram calls `/api/telegram-webhook`
2. Webhook performs the action (create issue / update status)
3. For approve: auto-advances to next phase and clears Review Status
4. Message is edited to show the action taken
5. Toast notification confirms the action

**Setup:**
1. Deploy your app (the webhook endpoint needs to be publicly accessible)
2. Register the webhook URL with Telegram:
   ```bash
   yarn telegram-webhook set https://your-app.vercel.app/api/telegram-webhook
   ```
3. Verify it's set:
   ```bash
   yarn telegram-webhook info
   ```

**Callback Data Formats:**
- Initial approval: `approve_request:{requestId}:{token}`
- Design review: `approve:{issueNumber}`, `changes:{issueNumber}`, `reject:{issueNumber}`

## Troubleshooting

### Common Issues

**"GITHUB_TOKEN environment variable is required"**
- Ensure `GITHUB_TOKEN` is set in your `.env` file
- Verify the token has correct scopes (`repo`, `project`)

**"Project not found"**
- Check `config.github.projectNumber` matches the project number in the URL
- Verify `config.github.ownerType` is correct ('user' vs 'org')

**"Status field not found in project"**
- Ensure your GitHub Project has a Status field
- Verify all required status values exist (see Setup section)

**"Review Status field not found"**
- Create the custom "Review Status" field in your project
- The field name must be exactly "Review Status"

**Agent timeout**
- Increase timeout: `--timeout 900` (15 minutes)
- For complex implementations, consider breaking into smaller features

**Git conflicts during implementation**
- Ensure working directory is clean before running implement agent
- The agent creates fresh branches from the default branch

### API Rate Limits

GitHub API has rate limits:
- 5,000 requests/hour for authenticated requests
- GraphQL: 5,000 points/hour

The agents are designed to minimize API calls. If you hit limits:
- Wait for the rate limit to reset
- Use `--limit` to process fewer items at once

## Child Project Setup (Quick Start)

For projects based on this template:

1. **Create bot GitHub account** (recommended - see "Bot Account Setup" section above)
   - Allows you to approve PRs created by agents
   - Clear separation between user and agent actions

2. **Set environment variables** in `.env`:
   ```bash
   # Admin token (your personal account) - for GitHub Projects
   GITHUB_TOKEN=your_personal_token

   # Bot token (bot account) - for PRs, issues, comments
   GITHUB_BOT_TOKEN=your_bot_token

   # Project configuration
   GITHUB_OWNER=your-username
   GITHUB_REPO=your-repo
   GITHUB_PROJECT_NUMBER=1
   GITHUB_OWNER_TYPE=user

   # Telegram (optional)
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   ```

3. **Create GitHub Project** with required statuses (see Setup section)

4. **Update Vercel and GitHub Actions** with both tokens (see "Bot Account Setup" section)

5. **Run agents** as normal - everything uses environment variables automatically

## File Structure

```
src/
├── agents/                          # CLI agent scripts
│   ├── index.ts                     # Master CLI (yarn github-workflows-agent)
│   ├── product-design.ts            # Generate product design
│   ├── tech-design.ts               # Generate technical design
│   ├── implement.ts                 # Implement + create PR
│   ├── auto-advance.ts              # Auto-advance approved items
│   └── shared/
│       ├── config.ts                # Agent-specific config + re-exports
│       ├── claude.ts                # Claude SDK runner
│       ├── notifications.ts         # Telegram notifications
│       ├── prompts.ts               # Prompt templates
│       ├── types.ts                 # Agent-specific types
│       └── index.ts                 # Barrel exports
├── server/
│   ├── project-management/          # Project management abstraction layer
│   │   ├── adapters/
│   │   │   └── github.ts            # GitHub Projects V2 adapter
│   │   ├── types.ts                 # Adapter interface + domain types
│   │   ├── config.ts                # Status constants, project config
│   │   └── index.ts                 # Singleton factory + exports
│   ├── github-sync/
│   │   └── index.ts                 # Server-side GitHub sync (approval flow)
│   └── github-status/
│       └── index.ts                 # Fetch/update GitHub Project status
├── apis/
│   └── feature-requests/
│       └── handlers/
│           ├── getGitHubStatus.ts   # API: fetch status for a request
│           ├── getGitHubStatuses.ts # API: get available status options
│           └── updateGitHubStatus.ts # API: update status (admin only)
├── pages/
│   └── api/
│       ├── telegram-webhook.ts      # Telegram callback webhook (all approvals)
│       └── feature-requests/
│           └── approve/
│               └── [requestId].ts   # Fallback approval endpoint (localhost only)

.github/
└── workflows/
    ├── issue-notifications.yml      # Issue event notifications
    ├── pr-notifications.yml         # PR event notifications
    ├── pr-checks.yml                # PR checks
    └── deploy-notify.yml            # Deployment notifications
```

## Related Documentation

- [Telegram Notifications](./telegram-notifications.md)
- [GitHub PR CLI](../CLAUDE.md#github-pr-cli-tool)
