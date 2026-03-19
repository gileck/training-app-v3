---
title: GitHub Agents Workflow Setup
description: Complete setup instructions for GitHub Projects and AI agents. Use this when setting up the workflow for the first time.
summary: "Setup requires: GitHub Project with 6-column Status field and Review Status field, two GitHub tokens (admin + bot), optional Telegram integration. Run `yarn verify-setup` to check configuration."
priority: 3
key_points:
  - "Create GitHub Project with 6-column Status field"
  - "Create Review Status field (Waiting for Review, Approved, Request Changes, Rejected)"
  - "Two tokens: GITHUB_TOKEN (admin/projects) + GITHUB_BOT_TOKEN (PRs/issues)"
  - "Optional: Telegram topics for organized notifications"
related_docs:
  - overview.md
  - ../telegram-notifications.md
---

> **DEPRECATED:** This guide is for the legacy GitHub Projects V2 integration.
> For new setups, use [setup-guide.md](./setup-guide.md) which uses MongoDB workflow-items.
> This file is kept for reference only.

# GitHub Agents Workflow - Setup Guide

Complete step-by-step setup instructions for the GitHub agents workflow.

## Prerequisites

- GitHub account (personal or organization)
- Access to create GitHub Projects
- Node.js and yarn installed
- Repository cloned locally

## Step 1: GitHub Project Setup

### Create the GitHub Project

1. Go to `https://github.com/users/{your-username}/projects` (or `https://github.com/orgs/{org-name}/projects` for organizations)
2. Click "New project"
3. Select "Board" view
4. Name it appropriately (e.g., "Feature Pipeline")

### Configure Status Column

The project uses a 6-column workflow. Create a Status field with these exact values:

| Status | Description |
|--------|-------------|
| `Backlog` | New items, not yet started |
| `Product Design` | AI generates product design, human reviews |
| `Bug Investigation` | AI investigates bug root cause, proposes fix options |
| `Technical Design` | AI generates tech design, human reviews |
| `Ready for development` | AI implements feature (picked up by implement agent) |
| `PR Review` | PR created, waiting for human review/merge |
| `Done` | Completed and merged |

**Note:** "Bug Investigation" should be positioned between "Product Design" and "Technical Design". Bugs are automatically routed to this column on approval. The Bug Investigator agent analyzes root causes and proposes fix options for admin review.

**How it works**: Each phase uses the Review Status field to track sub-states within that phase (see below). The implement agent automatically moves items from "Ready for development" to "PR Review" after creating a PR.

### Create Review Status Custom Field

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

## Step 2: GitHub Tokens Setup

The system uses **two separate GitHub tokens** for clear separation of concerns.

### Token Overview

```bash
# Admin token (your personal token) - for GitHub Projects operations
GITHUB_TOKEN=ghp_your_admin_token_here

# Bot token (bot account token) - for PRs, issues, and comments
GITHUB_BOT_TOKEN=ghp_your_bot_token_here

# Telegram bot token for notifications (optional but recommended)
TELEGRAM_BOT_TOKEN=xxxxxxxxxxxxx
```

### Why Two Tokens?

| Token | Used For | Who It Appears As |
|-------|----------|-------------------|
| `GITHUB_TOKEN` (admin) | GitHub Projects queries, project status updates, **PR reviews** | Your personal account (reviews), not visible (projects) |
| `GITHUB_BOT_TOKEN` (bot) | Creating PRs, issues, comments | `dev-agent-bot` (or your bot account name) |

### Token Usage Details

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

## Step 3: Get Admin Token (GITHUB_TOKEN)

1. Use your personal GitHub account
2. Go to Settings → Developer settings → Personal access tokens
3. Generate new token with scopes:
   - `repo` - Full control of private repositories
   - `project` - Full control of projects
4. Copy to `.env` as `GITHUB_TOKEN`

## Step 4: Bot Account Setup (Recommended)

### Why You Need a Bot Account

When agents use your personal GitHub token:
- ❌ You **cannot approve PRs** created by agents (GitHub doesn't allow PR authors to approve their own PRs)
- ❌ You **cannot differentiate** between your comments and agent comments
- ❌ All agent actions appear as if **you** took them

**Solution:** Create a separate bot GitHub account for agents.

### Create Bot GitHub Account

Use Gmail's +alias feature to avoid needing a new email:

1. If your email is `yourname@gmail.com`, use `yourname+bot@gmail.com`
2. Go to https://github.com/signup
3. Sign up with `yourname+bot@gmail.com`
4. Choose a username like `yourname-bot` or `dev-agent-bot`
5. Verify the email (Gmail delivers to your main inbox)

### Add Bot as Collaborator

1. Go to your repository → Settings → Collaborators
2. Add the bot account as a collaborator
3. Accept the invitation from the bot account

### Generate Bot Token

1. Log in to the bot account
2. Go to Settings → Developer settings → Personal access tokens
3. Generate new token with scopes: `repo`, `project`
4. Copy the token

### Update Local Environment

Add the bot token to your `.env.local` (keep your admin token too):
```bash
# Admin token (your personal account) - for GitHub Projects
GITHUB_TOKEN="ghp_your_admin_token_here"

# Bot token (bot account) - for PRs, issues, comments
GITHUB_BOT_TOKEN="ghp_bot_token_here"
```

### Update Vercel Production

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

### Update GitHub Actions

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

### Verify Bot Setup

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

## Step 5: Install Claude GitHub App (Recommended)

The implementation agent automatically triggers Claude Code to review PRs after creation. This requires installing the Claude GitHub App on your repository.

### Why Install Claude GitHub App?

When the implementation agent creates a PR, it posts a comment `@claude please review this PR`. The Claude GitHub App:
- Automatically reviews the PR code
- Posts inline comments on potential issues
- Provides a summary review
- Helps catch bugs before human review

### Installation Steps

1. **Go to the Claude GitHub App page:**
   - Visit: https://github.com/apps/claude

2. **Click "Install"** and select your repository

3. **Grant permissions:**
   - Read access to code and metadata
   - Read and write access to pull requests and issues

4. **Verify installation:**
   - Go to your repository → Settings → Integrations → GitHub Apps
   - Confirm "Claude" is listed

### How It Works in the Workflow

After the implementation agent creates a PR:
1. Agent posts comment: `@claude please review this PR`
2. Claude GitHub App receives the mention
3. Claude reviews the code and posts feedback
4. Human reviewer sees both the PR and Claude's review comments

**Note:** If the Claude GitHub App is not installed, the `@claude` mention will have no effect, but the workflow will continue normally. Human reviewers can still review the PR manually.

## Step 6: Telegram Setup (Optional but Recommended)

Telegram enables one-click approvals and instant notifications for the entire workflow.

1. See [docs/telegram-notifications.md](../telegram-notifications.md) for bot setup
2. Set `ownerTelegramChatId` in `src/app.config.js` for admin notifications

**Benefits of Telegram integration:**
- One-click approval buttons for feature requests and bug reports
- Routing buttons to select which phase to start in
- Design PR approve/reject buttons
- Implementation PR merge buttons with saved commit messages
- Real-time notifications for all workflow events

### Using Telegram Topics (Recommended)

You can organize notifications into separate topics within a single supergroup to reduce information overload:

| Topic | Env Variable | Notifications |
|-------|--------------|---------------|
| **Github Issues** | `GH_TELEGRAM_CHAT_ID` | PR events, issue events, comments |
| **Vercel Deployments** | `VERCEL_TELEGRAM_CHAT_ID` | Deployment started/success/failed |
| **Agents** | `AGENT_TELEGRAM_CHAT_ID` | Bug reports, feature routing, approvals, merges |

#### Setup Topics

1. **Create a supergroup** in Telegram and enable Topics (Settings → Topics)

2. **Create 3 topics**: "Github Issues", "Vercel Deployments", "Agents"

3. **Add your bot as admin** in the group (required to see messages in topics)

4. **Delete the webhook temporarily** (needed to get topic IDs):
   ```bash
   yarn telegram-webhook delete
   ```

5. **Get topic thread IDs** by running the setup script and sending a message from each topic:
   ```bash
   yarn telegram-setup
   ```

   Send a message from each topic. The script will show output like:
   ```
   Chat ID: -100xxxxxxxxx
   Topic Thread ID: 5
   Combined (for topics): -100xxxxxxxxx:5
   ```

   Press Ctrl+C after collecting all IDs.

6. **Configure environment variables** with the combined format (`chatId:threadId`):

   **`.env.local`:**
   ```bash
   GH_TELEGRAM_CHAT_ID="-100xxxxxxxxx:3"      # Github Issues topic
   VERCEL_TELEGRAM_CHAT_ID="-100xxxxxxxxx:4"  # Vercel Deployments topic
   AGENT_TELEGRAM_CHAT_ID="-100xxxxxxxxx:2"   # Agents topic
   ```

7. **Set GitHub secrets** (for GitHub Actions):
   ```bash
   gh secret set GH_TELEGRAM_CHAT_ID --body "-100xxxxxxxxx:3"
   gh secret set VERCEL_TELEGRAM_CHAT_ID --body "-100xxxxxxxxx:4"
   ```

   **Note:** GitHub doesn't allow secrets starting with `GITHUB_`, so we use `GH_TELEGRAM_CHAT_ID`.

8. **Set Vercel env var** (for app runtime):
   ```bash
   echo "-100xxxxxxxxx:2" | vercel env add AGENT_TELEGRAM_CHAT_ID production
   echo "-100xxxxxxxxx:2" | vercel env add AGENT_TELEGRAM_CHAT_ID preview
   ```

9. **Re-enable the webhook**:
   ```bash
   yarn telegram-webhook set https://your-app.vercel.app
   ```

10. **Redeploy** to pick up the new env var:
    ```bash
    vercel --prod --yes
    ```

#### Format Reference

The combined format `chatId:threadId` is backward compatible:
- `-100xxxxxxxxx` → sends to the group (General topic)
- `-100xxxxxxxxx:5` → sends to topic with thread ID 5

If you prefer a single chat for all notifications, just use the same chat ID everywhere without the thread ID suffix.

## Step 7: Environment Configuration

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

**Note:** The status values in `STATUSES` and `REVIEW_STATUSES` are constants defined in `src/server/template/project-management/config.ts` and should NOT be modified.

## Step 8: Verify Setup

Run the setup verification script:
```bash
yarn verify-setup
```

This checks:
- GitHub tokens are set
- GitHub Project exists and is accessible
- Required custom fields exist (Status, Review Status)
- Telegram bot is configured (if enabled)
- Agent configuration is valid

## Next Steps

After completing setup:

1. **Test the workflow**: Submit a test feature request via the app UI
2. **Approve it**: Click the Telegram approval button
3. **Route it**: Choose a starting phase (try "Ready for development" for a simple test)
4. **Run agents**: Execute agents manually or set up cron jobs

**Agent commands:**
```bash
yarn agent:product-design
yarn agent:bug-investigator
yarn agent:tech-design
yarn agent:implement
yarn agent:pr-review
```

## Troubleshooting

### "Cannot find project"
- Verify `GITHUB_PROJECT_NUMBER` matches your project's number (visible in project URL)
- Check that `GITHUB_OWNER` and `GITHUB_OWNER_TYPE` are correct

### "Missing required field"
- Ensure custom fields are named exactly: `Review Status` (case-sensitive)
- Verify field options match the exact values listed above

### "Cannot approve own PR"
- You need to set up a bot account (see Step 4)
- Ensure `GITHUB_BOT_TOKEN` is configured

### Telegram buttons not working
- Verify `TELEGRAM_BOT_TOKEN` is set
- Check that `ownerTelegramChatId` is configured in `src/app.config.js`
- Ensure the webhook is accessible at `/api/telegram-webhook`

## Related Documentation

- **[overview.md](./overview.md)** - System architecture and workflow
- **[workflow-items-architecture.md](./workflow-items-architecture.md)** - Workflow items data model
- **[Main integration docs](../github-projects-integration.md)** - Complete reference
