# GitHub Projects Workflow - Getting Started Guide

Complete setup guide for child projects that want to use the GitHub Projects workflow from this template.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step 1: GitHub Project V2 Setup](#step-1-github-project-v2-setup)
- [Step 2: Environment Variables (.env)](#step-2-environment-variables-env)
- [Step 3: Telegram Bot Setup](#step-3-telegram-bot-setup)
- [Step 4: GitHub Repository Secrets & Variables](#step-4-github-repository-secrets--variables)
- [Step 5: Vercel Environment Variables](#step-5-vercel-environment-variables)
- [Step 6: Verification & Testing](#step-6-verification--testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

This workflow automates the complete feature request and bug report pipeline:

**User submits → Admin approves → AI designs → AI implements → PR created → Admin merges → Auto-marked Done**

### What You'll Get

- **Feature request management** via app UI
- **Automated GitHub issue creation** with one-click Telegram approval
- **AI-powered design generation** (product design, technical design)
- **AI-powered implementation** with PR creation
- **Auto-completion** when PRs are merged
- **Telegram notifications** at each step with inline action buttons
- **Flexible routing** - choose starting phase per item (skip design phases for simple fixes)

### Key Features

- **Squash-merge ready PRs** - No editing needed before merge
- **Two-tier status tracking** - MongoDB tracks high-level status, GitHub Projects tracks detailed workflow
- **Type-aware agents** - Automatically detects bugs vs features and uses specialized prompts
- **Bug diagnostics** - Session logs, stack traces, and error messages included in bug fix prompts (agents warn if diagnostics are missing)

---

## ⚠️ CRITICAL SAFETY WARNINGS - Read This First!

### Vercel Project ID Confusion

**MOST COMMON MISTAKE:** Pushing environment variables to the wrong Vercel project.

**The Problem:**
- Vercel tokens are per-user, not per-project
- One token can access ALL your projects
- Using the wrong project ID will overwrite another project's configuration

**Before running `yarn vercel-cli env:push`:**
1. Get your project ID: `vercel project ls` or check `.vercel/project.json`
2. Verify it's correct: `yarn vercel-cli project`
3. **STOP AND DOUBLE-CHECK** - You're about to overwrite production environment variables
4. If you have multiple projects from this template, triple-check the project ID

**Signs you pushed to the wrong project:**
- Telegram bot stops working in another project
- Another app's GitHub integration breaks
- You see env vars from one project in another

### .env.local Takes Precedence

Scripts read `.env.local` FIRST, then `.env`. If you have both files with different values, `.env.local` wins.

**Recommendation:** Use `.env.local` as your single source of truth, not `.env`.

### Token Scope Requirements

**CRITICAL:** Your GitHub token MUST have BOTH `repo` AND `project` scopes from the start.

**Common mistake:** Creating a token with only `repo` scope, then discovering `project` is missing during testing.

**If you need to regenerate your token:**
1. Generate a new token with both scopes
2. Update `.env.local` with new token
3. Re-push to Vercel: `yarn vercel-cli env:push --target production --overwrite`
4. Re-push to GitHub Actions: `yarn setup-github-secrets`

---

## Prerequisites

> **🚨 CRITICAL: package.json Must Be Synced From Template**
>
> This workflow requires the template's `package.json` with all the required scripts (`yarn telegram-setup`, `yarn verify-setup`, `yarn agent:*`, etc.).
>
> **If you're using template sync:**
> - Do NOT add `package.json` to `ignoredFiles` or `projectSpecificFiles` in `.template-sync.json`
> - Keep `package.json` synced from the template to get workflow updates
>
> **If you've customized package.json:**
> - You can add custom scripts, but DO NOT remove template scripts
> - Check that these scripts exist: `telegram-setup`, `verify-setup`, `agent:product-design`, `agent:tech-design`, `agent:implement`, `setup-github-secrets`, `vercel-cli`, `github-pr`

Before starting, ensure you have:

- [ ] A GitHub account
- [ ] A repository (forked/cloned from this template)
- [ ] **`package.json` synced from template** (see warning above)
- [ ] Node.js and yarn installed
- [ ] GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
- [ ] A Telegram account (for notifications)
- [ ] A Vercel account (for deployment)

---

## Quick Start - Recommended Order

Follow these steps IN ORDER to avoid common mistakes:

1. ✅ **Create `.env.local` from `.env.example` FIRST**
   ```bash
   cp .env.example .env.local
   ```

2. ✅ **Generate GitHub token with BOTH scopes (repo + project)**
   - Add to `.env.local` immediately
   - Test it: `gh auth status`

3. ✅ **Create GitHub Project (get project number)**
   - Add to `.env.local`

4. ✅ **Create Telegram bot (get token and chat ID)**
   - Add both to `.env.local`
   - Update `src/app.config.js`

5. ✅ **Verify locally BEFORE touching Vercel/GitHub:**
   ```bash
   yarn verify-setup --skip-vercel --skip-github
   ```

6. ✅ **Deploy to Vercel (so you have a URL for webhook)**

7. ✅ **Push to Vercel (DOUBLE-CHECK project ID first!):**
   ```bash
   # Verify project ID first
   yarn vercel-cli project

   # If correct, push
   yarn vercel-cli env:push --target production --overwrite
   ```

8. ✅ **Set Telegram webhook (after deployment)**

9. ✅ **Setup GitHub Actions (secrets and variables)**

10. ✅ **Final verification:**
    ```bash
    yarn verify-setup
    yarn verify-production --url https://your-app.vercel.app
    yarn verify-credentials
    ```

---

## Step 1: GitHub Project V2 Setup

### Create the GitHub Project

1. Go to `https://github.com/users/{your-username}/projects`
   - Replace `{your-username}` with your GitHub username
   - For organizations: `https://github.com/orgs/{org-name}/projects`

2. Click **"New project"**

3. Select **"Board"** view

4. Name it (e.g., "Feature Pipeline" or "Product Workflow")

5. Click **"Create project"**

### Configure Status Column

The Status field should already exist. Configure it with these **exact** values:

| Status | Description |
|--------|-------------|
| `Backlog` | New items, not yet started |
| `Product Design` | AI generates product design, human reviews |
| `Technical Design` | AI generates tech design, human reviews |
| `Ready for development` | AI implements feature |
| `PR Review` | PR created, waiting for human review/merge |
| `Done` | Completed and merged |

**To configure:**
1. Click on the Status column header
2. Edit the field options
3. Add/rename status values to match the table above (exact spelling required)

### Create Review Status Custom Field

> **⚠️ CRITICAL:** All 6 options are REQUIRED. Missing any option will cause agent failures.
>
> **COMMON MISTAKE:** Forgetting to add "Waiting for Clarification" and "Clarification Received".
> These statuses are used when agents need input from admin. Without them, agents will fail when they encounter ambiguous requirements.

1. In your project, click the **"+"** button (add field)
2. Select **"Single select"**
3. Name it exactly: `Review Status`
4. Add these **exact** options (case-sensitive, all 6 required):
   1. `Waiting for Review`
   2. `Approved`
   3. `Request Changes`
   4. `Rejected`
   5. `Waiting for Clarification` ⚠️ **REQUIRED** - Agents fail without this
   6. `Clarification Received` ⚠️ **REQUIRED** - Agents fail without this
5. Click **"Save"**

**After setup, run `yarn verify-setup` to validate all 6 status options exist.**

**Verification:** Your field should show all 6 options as in the screenshot below. If any are missing, agents will fail with "Unknown review status" errors.

![Review Status Options](https://github.com/user-attachments/assets/...) <!-- User should see all 6 options -->

**What this field tracks:**

| Review Status | Meaning |
|---------------|---------|
| *(empty)* | Ready for AI agent to process |
| `Waiting for Review` | AI finished, human needs to review |
| `Approved` | Human approved, ready to advance to next phase (auto-advances) |
| `Request Changes` | Human wants revisions, AI will address feedback |
| `Rejected` | Won't proceed with this item |
| `Waiting for Clarification` | AI needs input from admin |
| `Clarification Received` | Admin answered, AI should resume |

### Create Implementation Phase Custom Field (Optional - for Multi-PR Workflow)

This field enables splitting large features (L/XL) into multiple PRs. **Optional** - without it, all features are implemented in a single PR.

1. In your project, click the **"+"** button (add field)
2. Select **"Text"** (NOT Single select)
3. Name it exactly: `Implementation Phase`
4. Click **"Save"**

**What this field tracks:**

The field stores values like "1/3" (phase 1 of 3). It's automatically managed by the agents:
- Set when implementation starts on an L/XL feature
- Incremented when each phase's PR is merged
- Cleared when all phases are complete

**How Phase Tracking Works:**

The system uses a two-layer approach for storing and retrieving implementation phases:

| Component | Storage | Usage |
|-----------|---------|-------|
| **Phase Counter** | GitHub Project Field (`Implementation Phase`) | Tracks current phase: `"1/3"` |
| **Phase Details** | GitHub Issue Comment | Stores phase names, descriptions, files |

**Tech Design Agent:**
1. Generates phases for L/XL features
2. Posts phases as a GitHub issue comment with marker `<!-- AGENT_PHASES_V1 -->`
3. Format is deterministic (not LLM-generated)

**Implementation Agent:**
1. Reads phases from comment (reliable) or markdown (fallback)
2. Implements current phase
3. Creates PR with phase info

**Example Workflow:**
```
1. Tech design generates phases → Posts comment with phase details
2. Implementation reads comment → Gets phase 1 details
3. Creates PR for phase 1 → Sets field to "1/3"
4. PR merged → Script updates field to "2/3"
5. Implementation reads comment → Gets phase 2 details
6. Repeat until all phases complete
```

**When to add this field:**
- **Add it** if you want large features to be split into multiple PRs
- **Skip it** if you prefer all features to be single-PR (simpler workflow)

See [Multi-PR Workflow](./github-projects-integration.md#multi-pr-workflow-lxl-features) for details.

### Get Your Project Number

Look at the project URL:
```
https://github.com/users/your-username/projects/3
                                              ↑
                                         This is your project number
```

**Write this down** - you'll need it for environment variables.

---

## Step 2: Environment Variables (.env.local)

> **⚠️ CRITICAL: Use .env.local (NOT .env)**
>
> All scripts prioritize `.env.local` over `.env`. This is Next.js convention for local secrets. If you use `.env`, some scripts may not find your variables.

Add these variables to your `.env.local` file in the project root:

**First time setup:**
```bash
# Copy the example file
cp .env.example .env.local

# Then edit .env.local with your actual values
```

```bash
# GitHub Configuration (REQUIRED)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx        # Admin token for GitHub Projects (see below)
GITHUB_BOT_TOKEN=ghp_yyyyyyyyyyyyyy   # Bot token for PRs/issues (recommended, see Step 2.5)
GITHUB_OWNER=your-username             # Your GitHub username or org name
GITHUB_REPO=your-repo-name             # Your repository name
GITHUB_PROJECT_NUMBER=1                # From Step 1 (your project number)
GITHUB_OWNER_TYPE=user                 # 'user' or 'org'

# Telegram Configuration (REQUIRED for notifications)
TELEGRAM_BOT_TOKEN=your_bot_token      # From BotFather (see Step 3)
LOCAL_TELEGRAM_CHAT_ID=your_chat_id    # From yarn telegram-setup (see Step 3)
```

### Getting a GitHub Token

> **❗ BOTH scopes are REQUIRED:**
> - ✅ **repo** (for issues/PRs)
> - ✅ **project** (for GitHub Projects V2)
>
> Missing either scope will cause errors later.

#### Option 1: Fine-grained Personal Access Token (Recommended)

1. Go to **GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **"Generate new token"**
3. Configure:
   - **Token name**: `GitHub Projects Workflow`
   - **Expiration**: Choose your preference (90 days recommended)
   - **Repository access**: Select your specific repository
   - **Permissions**:
     - Repository permissions:
       - **Contents**: Read and write
       - **Issues**: Read and write
       - **Pull requests**: Read and write
       - **Metadata**: Read-only (auto-selected)
     - Account permissions:
       - **Projects**: Read and write
4. Click **"Generate token"**
5. **Copy the token immediately** (you won't see it again)
6. Add to your `.env.local` file as `GITHUB_TOKEN=ghp_xxxxx`

#### Option 2: Classic Personal Access Token

1. Go to **GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Select scopes:
   - ✅ `repo` - Full control of private repositories
   - ✅ `project` - Full control of projects
4. Click **"Generate token"**
5. Copy the token and add to `.env.local`

**Security tip:** Never commit your `.env.local` file. It's already in `.gitignore`.

### ⚠️ Token Must Have BOTH Scopes From The Start

**CRITICAL:** Your GitHub token MUST have BOTH `repo` AND `project` scopes.

**Common mistake:** Creating a token with only `repo` scope, then discovering `project` is missing later during testing.

**Verification:** After generating your token, verify it has both scopes:
```bash
# Test repo access
yarn github-pr list --state all --limit 1

# Test project access (will fail if project scope is missing)
yarn verify-setup --skip-vercel --skip-github
```

**If you need to regenerate your token:**
1. Generate a new token with both scopes
2. Update `.env.local` with new token
3. Re-push to Vercel: `yarn vercel-cli env:push --target production --overwrite`
4. Re-push to GitHub Actions: `yarn setup-github-secrets`

### Important: Do NOT Add PROJECT_TOKEN to .env files

**Common confusion:** Some users add both `GITHUB_TOKEN` and `PROJECT_TOKEN` to `.env.local`.

**The truth:**
- `.env.local`: Only needs `GITHUB_TOKEN`
- GitHub Actions: Only needs `PROJECT_TOKEN` secret (which contains the same value)

**Why two names?**
- GitHub Actions reserves the `GITHUB_*` prefix for built-in variables
- We use `PROJECT_TOKEN` as the secret name to avoid conflicts
- But they contain the SAME token value

**Bottom line:** Your `.env.local` should only have `GITHUB_TOKEN`, never `PROJECT_TOKEN`.

### Step 2.5: Bot Account Setup (Recommended)

**Why you need a bot account:**

When agents use your personal GitHub token:
- ❌ You **cannot approve PRs** created by agents (GitHub doesn't allow PR authors to approve their own PRs)
- ❌ You **cannot differentiate** between your comments and agent comments
- ❌ All agent actions appear as if **you** took them

**Solution:** Create a separate bot GitHub account for agents.

**Quick Setup:**

1. **Create Bot GitHub Account** (use Gmail +alias trick):
   - If your email is `yourname@gmail.com`, use `yourname+bot@gmail.com`
   - Sign up at https://github.com/signup
   - Choose username like `yourname-bot` or `dev-agent-bot`

2. **Add Bot as Collaborator**:
   - Go to your repository → Settings → Collaborators
   - Add the bot account as a collaborator
   - Accept the invitation from the bot account

3. **Generate Bot Token**:
   - Log in to the bot account
   - Generate a token (same scopes as above: `repo`, `project`)
   - Add to `.env.local` as `GITHUB_BOT_TOKEN`

**Result:**
- ✅ All PRs created by bot account (not you)
- ✅ You can approve/request changes on PRs
- ✅ Clear separation between user and agent actions

**If you skip this:**

The system will use **single-token mode** (`GITHUB_TOKEN` for everything). You won't be able to approve agent-created PRs, but the workflow will otherwise function normally.

For detailed instructions, see the [Bot Account Setup](./github-projects-integration.md#bot-account-setup-recommended) section in the main integration guide.

---

## Step 3: Telegram Bot Setup

> **⚠️ IMPORTANT: Create a NEW Bot for This Project**
>
> **Do NOT reuse an existing bot from another project!** Each project needs its own dedicated Telegram bot because a bot can only have ONE webhook URL at a time. Sharing a bot across projects will break button callbacks (Approve, Route, etc.).
>
> Creating a new bot takes ~2 minutes and is completely free.

### Why Each Project Needs Its Own Bot

**CRITICAL:** Each child project must create its own Telegram bot.

**Why?**
- A Telegram bot can only have **ONE webhook URL** at a time
- Each deployed app has a different URL (e.g., `https://my-app.vercel.app`)
- If multiple projects share a bot, button callbacks (Approve, Route, etc.) won't work correctly

**The solution:** Create a new bot for each project (takes ~2 minutes, completely free).

### Step 3.1: Create Your Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Start a chat with BotFather
3. Send `/newbot`
4. Follow the prompts:
   - **Bot name**: `My Project Bot` (display name, can be anything)
   - **Bot username**: `myproject_bot` (must end in `_bot`, must be unique across all Telegram)
5. BotFather will reply with your bot token:
   ```
   Use this token to access the HTTP API:
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
6. **Copy this token** and add to your `.env.local` file:
   ```bash
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

### Step 3.2: Get Your Chat ID (Simple Mode)

Use this for a single chat receiving all notifications. For separate topics, see Step 3.2b below.

1. Run the telegram setup script:
   ```bash
   yarn telegram-setup
   ```

2. The script will wait for a message. Open Telegram and:
   - Search for your bot (the username you created, e.g., `@myproject_bot`)
   - Start a chat with your bot
   - Send any message (e.g., "hello")

3. The script will display your chat ID:
   ```
   ========================================
   Your Chat ID: 123456789
   ========================================
   ```

4. Add this to your `.env.local` file:
   ```bash
   LOCAL_TELEGRAM_CHAT_ID=123456789
   ```

5. **Also update** `src/app.config.js`:
   ```javascript
   export const appConfig = {
       appName: 'My Project Name',
       // ... other config ...
       ownerTelegramChatId: '123456789',  // Your chat ID here
   };
   ```

### Step 3.2b: Separate Topics (Advanced Mode - Recommended)

Split notifications into 3 separate Telegram topics to reduce noise:

| Topic | Frequency | What it receives |
|-------|-----------|------------------|
| **Vercel Deployments** | Low | Deploy success/failure |
| **GitHub Activity** | Medium | PR merged, issues created |
| **Agent Workflow** | High | Approvals, agent progress |

#### Create Forum Group with Topics

1. **Create a Telegram supergroup** (not a regular group)
2. **Enable Topics**: Group Settings → Topics → Enable
3. **Create 3 topics**:
   - `Vercel Deployments`
   - `GitHub Activity`
   - `Agent Workflow`
4. **Add your bot** to the group

#### Configure Bot for Forum Groups

> **⚠️ CRITICAL: Forum groups require extra bot configuration**

1. **Disable Privacy Mode** (required to receive messages):
   - Message **@BotFather** → `/mybots` → Select your bot
   - **Bot Settings → Group Privacy → Turn OFF**

2. **Make bot an admin** (required for topics):
   - In your group, tap the bot's name
   - **Promote to Admin** with "Manage Topics" permission

3. **Reset message filter** (if bot still doesn't receive messages):
   ```bash
   # Check current filter
   TOKEN=$(grep "^TELEGRAM_BOT_TOKEN" .env.local | cut -d'=' -f2 | tr -d '"')
   curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | jq '.result.allowed_updates'

   # If it only shows ["callback_query"], reset it:
   curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url":"","allowed_updates":["message","callback_query","channel_post","edited_message"]}'
   ```

#### Get Topic IDs

1. **Delete webhook temporarily** (required for `yarn telegram-setup` to work):
   ```bash
   yarn telegram-webhook delete
   ```

2. **Run setup script**:
   ```bash
   yarn telegram-setup
   ```

3. **Send a message in each topic**. The script outputs combined IDs:
   ```
   Combined ID: -1001234567890:123
                ↑ group chat ID  ↑ topic thread ID
   ```

4. **Collect all 3 IDs** (press Ctrl+C when done):
   ```
   Vercel Deployments:  -1001234567890:2
   GitHub Activity:     -1001234567890:14
   Agent Workflow:      -1001234567890:16
   ```

5. **Add to `.env.local`**:
   ```bash
   # Simple mode fallback
   LOCAL_TELEGRAM_CHAT_ID="5781511728"

   # Separate notification channels (forum topics)
   VERCEL_TELEGRAM_CHAT_ID="-1001234567890:2"
   GITHUB_TELEGRAM_CHAT_ID="-1001234567890:14"
   AGENT_TELEGRAM_CHAT_ID="-1001234567890:16"
   ```

6. **Test each topic**:
   ```bash
   TOKEN=$(grep "^TELEGRAM_BOT_TOKEN" .env.local | cut -d'=' -f2 | tr -d '"')

   # Test Vercel topic
   curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
     -H "Content-Type: application/json" \
     -d '{"chat_id":"-1001234567890","message_thread_id":2,"text":"✅ Vercel topic works!"}'

   # Test GitHub topic
   curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
     -H "Content-Type: application/json" \
     -d '{"chat_id":"-1001234567890","message_thread_id":14,"text":"✅ GitHub topic works!"}'

   # Test Agent topic
   curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
     -H "Content-Type: application/json" \
     -d '{"chat_id":"-1001234567890","message_thread_id":16,"text":"✅ Agent topic works!"}'
   ```

### Step 3.3: Set Telegram Webhook (After Deployment)

**Important:** Do this AFTER deploying your app to Vercel (Step 5).

Once your app is deployed and you have the production URL:

```bash
yarn telegram-webhook set https://your-app.vercel.app/api/telegram-webhook
```

Verify it's set correctly:
```bash
yarn telegram-webhook info
```

You should see:
```json
{
  "url": "https://your-app.vercel.app/api/telegram-webhook",
  "has_custom_certificate": false,
  "pending_update_count": 0
}
```

**What this does:**
- Configures Telegram to send button callbacks (Approve, Route, etc.) to your app
- Enables instant in-app feedback when you tap Telegram buttons
- Required for the one-click approval workflow

> **💡 Note on 405 Errors:**
>
> If you test the webhook URL directly in your browser, you'll see "405 Method Not Allowed". This is **NORMAL** - the endpoint expects specific Telegram callback data via POST requests. Buttons will work correctly when you test with real notifications (see Step 6.5 below).

---

## Step 4: GitHub Repository Secrets & Variables

> **📝 Why PROJECT_* prefix in GitHub Actions?**
>
> GitHub Actions reserves `GITHUB_*` prefix for its own built-in variables. We use `PROJECT_*` prefix in GitHub Actions but `GITHUB_*` locally in `.env.local`.
>
> **The VALUES are the same - only the NAMES differ:**
> - Local `.env.local`: `GITHUB_OWNER=myusername`
> - GitHub Actions: `PROJECT_OWNER=myusername`

Your GitHub Actions workflows need access to Telegram credentials to send notifications.

### Option 1: Automatic Setup (Recommended)

Run the setup script to configure everything automatically:

```bash
yarn setup-github-secrets
```

This script will:
- Read from your `.env` file
- Push secrets and variables to GitHub
- Verify all required values are present

**Prerequisites:**
- GitHub CLI (`gh`) must be installed and authenticated
- `.env.local` file must contain `TELEGRAM_BOT_TOKEN`, `LOCAL_TELEGRAM_CHAT_ID`, and `GITHUB_TOKEN`

### Option 2: Manual Setup

If you prefer to set these manually:

**Repository Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Secret Name | Value | Source | Used By |
|-------------|-------|--------|---------|
| `TELEGRAM_BOT_TOKEN` | Your bot token | From BotFather (Step 3.1) | All workflows |
| `TELEGRAM_CHAT_ID` | Your chat ID | From `yarn telegram-setup` (Step 3.2) | Fallback |
| `PROJECT_TOKEN` | Your GitHub token | Use the value from `GITHUB_TOKEN` in your `.env.local` | GitHub API calls |

> **Note:** `PROJECT_TOKEN` is ONLY used as a GitHub Actions secret name. You do NOT need to add it to your `.env.local` file.

**Additional Secrets for Separate Topics (Advanced Mode):**

> **⚠️ CRITICAL: GitHub blocks `GITHUB_*` prefix for secrets!**
>
> You CANNOT use `GITHUB_TELEGRAM_CHAT_ID` as a secret name. Use `GH_TELEGRAM_CHAT_ID` instead.

| Secret Name | Value | Used By |
|-------------|-------|---------|
| `VERCEL_TELEGRAM_CHAT_ID` | `-100xxx:2` (Vercel topic) | `deploy-notify.yml` |
| `GH_TELEGRAM_CHAT_ID` | `-100xxx:14` (GitHub topic) | `issue-notifications.yml`, `pr-notifications.yml` |
| `LOCAL_TELEGRAM_CHAT_ID` | Your personal chat ID | Fallback for all workflows |

**Quick setup for separate topics:**
```bash
# Set secrets (replace with your actual IDs)
gh secret set VERCEL_TELEGRAM_CHAT_ID --body "-1001234567890:2" -R owner/repo
gh secret set GH_TELEGRAM_CHAT_ID --body "-1001234567890:14" -R owner/repo
gh secret set LOCAL_TELEGRAM_CHAT_ID --body "5781511728" -R owner/repo
```

**Fallback hierarchy:**
- Vercel deployments: `VERCEL_TELEGRAM_CHAT_ID` → `LOCAL_TELEGRAM_CHAT_ID`
- GitHub activity: `GH_TELEGRAM_CHAT_ID` → `TELEGRAM_CHAT_ID`
- Agent workflow: Uses `AGENT_TELEGRAM_CHAT_ID` from Vercel env vars (not GitHub secrets)

**Repository Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `TELEGRAM_NOTIFICATIONS_ENABLED` | `true` | Enables GitHub Actions notifications |
| `PROJECT_OWNER` | `your-username` | Your GitHub username or org |
| `PROJECT_REPO` | `your-repo-name` | Your repository name |
| `PROJECT_NUMBER` | `1` | Your project number |
| `PROJECT_OWNER_TYPE` | `user` | `user` or `org` |

> **📝 Note on Naming Convention:**
> GitHub Actions variables use `PROJECT_*` prefix for consistency and clarity. This is intentional and different from your local `.env` file which uses `GITHUB_*` names. The values should match - just the names differ between contexts:
> - **Local `.env`**: `GITHUB_OWNER=your-username`
> - **GitHub Actions**: `PROJECT_OWNER=your-username`

### Enable Workflow Permissions

For auto-completion to work when PRs are merged:

1. Go to **Settings → Actions → General**
2. Under **"Workflow permissions"**, select:
   - ✅ **"Read and write permissions"**
3. Click **"Save"**

---

## Step 5: Vercel Environment Variables

Push your environment variables to Vercel so the deployed app can access them.

**⚠️ CRITICAL:** GitHub status integration in production requires ALL 5 GitHub environment variables to be set in Vercel.

**Note on naming:** Your local `.env` uses `GITHUB_*` prefix, but these variables in Vercel must match the names exactly as shown in your `.env` file.

Missing even one variable will cause GitHub statuses to show as empty in the feature-request page.

### 🔗 STEP 0: Link to Vercel Project (REQUIRED)

**⚠️ YOU MUST DO THIS FIRST** before running ANY `yarn vercel-cli` commands:

```bash
vercel link
```

**Why this is critical:**
- Creates `.vercel/project.json` with your project ID
- Prevents accidentally pushing env vars to the WRONG Vercel project
- Required for all vercel-cli commands to work correctly

**What happens if you skip this:**
- `yarn vercel-cli` commands will fail with an error
- Or worse: might target a different project if you have multiple template projects
- Could overwrite another project's environment variables

**Verification:**
```bash
# Check that .vercel/project.json exists
ls .vercel/project.json

# Verify correct project
yarn vercel-cli project
```

**Expected output:**
```
📦 Project: your-actual-project-name
🆔 ID: prj_xxxxxxxxxxxxx
🔗 URL: https://your-actual-project.vercel.app
```

### ⚠️ CRITICAL: Verify Project ID Before Pushing

**Before running ANY `yarn vercel-cli` commands that modify env vars:**

1. **Check which project you're linked to:**
   ```bash
   yarn vercel-cli project
   ```

2. **Expected output:**
   ```
   📦 Project: your-actual-project-name
   🆔 ID: prj_xxxxxxxxxxxxx
   🔗 URL: https://your-actual-project.vercel.app
   ```

3. **Verify this matches your intended project:**
   - Check the project name
   - Check the URL
   - If you have multiple projects, double-check this is the right one

4. **If it's wrong:**
   - Run `vercel link` to link to the correct project
   - Or manually specify project ID: `--project-id prj_xxxxx`

**DO NOT PROCEED until you're 100% certain the project ID is correct.**

### Option 1: Using Vercel CLI (Recommended)

**Prerequisites:**
- Completed "STEP 0: Link to Vercel Project" above ✅
- `.vercel/project.json` exists and verified ✅

1. Install Vercel CLI globally (if not already):
   ```bash
   npm i -g vercel
   ```

2. **Verify project ID BEFORE pushing** (critical!):
   ```bash
   yarn vercel-cli project
   ```

   If this command fails or shows the wrong project, go back to STEP 0.

3. Push environment variables from `.env.local`:
   ```bash
   yarn vercel-cli env:push --file .env.local --target production --overwrite
   ```

   This will push all variables from `.env.local` to production.

5. **Verify all GitHub variables were pushed:**
   ```bash
   yarn vercel-cli env --target production | grep GITHUB_
   ```

   **Expected output** (minimum 5 required variables):
   ```
   📝 GITHUB_TOKEN                   = [hidden]
   📝 GITHUB_BOT_TOKEN               = [hidden]  (optional but recommended)
   📝 GITHUB_OWNER                   = [hidden]
   📝 GITHUB_REPO                    = [hidden]
   📝 GITHUB_PROJECT_NUMBER          = [hidden]
   📝 GITHUB_OWNER_TYPE              = [hidden]
   ```

   **Note:** `GITHUB_BOT_TOKEN` is optional but recommended if you're using a bot account (see Step 2.5). If you don't have a bot account, you'll only see 5 variables.

4. **Production URL (Optional - Vercel provides this automatically):**

   ✅ **Good news:** Vercel automatically sets `VERCEL_PROJECT_PRODUCTION_URL` with your stable production domain.

   You only need to manually set `NEXT_PUBLIC_APP_URL` if:
   - You're using a custom domain (not `*.vercel.app`)
   - You want to override the automatic URL for testing

   If needed:
   ```bash
   # Create temporary file with production URL
   echo "NEXT_PUBLIC_APP_URL=https://your-custom-domain.com" > .env.prod-url

   # Push to production
   yarn vercel-cli env:push --file .env.prod-url --target production

   # Clean up
   rm .env.prod-url
   ```

   **How URL resolution works:**
   1. `VERCEL_PROJECT_PRODUCTION_URL` - Stable production domain (automatic) ✅
   2. `VERCEL_URL` - Deployment-specific URL (automatic)
   3. `NEXT_PUBLIC_APP_URL` - Manual override (optional)
   4. Falls back to `localhost:3000` for local dev

5. To push to all environments (development, preview, production):
   ```bash
   yarn vercel-cli env:push --file .env.local
   ```

### Option 2: Using Vercel Dashboard

1. Go to your project on Vercel
2. Click **Settings → Environment Variables**
3. Add each variable from your `.env.local` file:
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PROJECT_NUMBER`
   - `GITHUB_OWNER_TYPE`
   - `TELEGRAM_BOT_TOKEN`
   - `NEXT_PUBLIC_APP_URL` (optional - only for custom domains)
   - `MONGO_URI` (your MongoDB connection string)
   - `JWT_SECRET` (generate a random string)
   - Any other app-specific variables

4. For each variable, select which environments it applies to:
   - **Production**: Production deployments
   - **Preview**: PR preview deployments
   - **Development**: Local development (`vercel dev`)

### Redeploy After Adding Variables

After adding environment variables, redeploy your app:
```bash
vercel --prod
```

Or push a commit to trigger automatic deployment.

---

## Step 6: Verification & Testing

Test each component to ensure everything is configured correctly.

### 6.0: Automated Setup Verification (Recommended)

Before testing individual components, run the automated verification script to check all configuration at once:

```bash
yarn verify-setup
```

**What it checks:**

1. **Local Environment** (`.env.local`)
   - All required GitHub variables (TOKEN, OWNER, REPO, PROJECT_NUMBER, OWNER_TYPE)
   - Telegram variables (BOT_TOKEN, CHAT_ID)
   - Database and auth variables (MONGO_URI, JWT_SECRET, ADMIN_USER_ID)
   - `app.config.js` ownerTelegramChatId configuration

2. **Vercel Environment** (Production)
   - All required variables are set in Vercel production
   - Vercel project is linked

3. **GitHub Repository**
   - GitHub CLI (gh) installed and authenticated
   - Required secrets (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, PROJECT_TOKEN)
   - Required variables (all GitHub and Telegram config)
   - Workflow permissions (read-write access)

4. **Token Permissions** (NEW - actual API permission tests)
   - `GITHUB_TOKEN` can access the repository (repo scope)
   - `GITHUB_TOKEN` can access GitHub Projects V2 (project scope)
   - `GITHUB_BOT_TOKEN` can access repo (if set)
   - Shows which GitHub user each token authenticates as

5. **GitHub Project**
   - Project exists and is accessible
   - Review Status field has all 6 required options
   - Implementation Phase field exists (for multi-PR workflow)

**Expected output (all passing):**
```
🔍 Verifying GitHub Projects Workflow Setup
══════════════════════════════════════════════════════════════════════

📋 Local Environment
──────────────────────────────────────────────────────────────────────
✓ .env.local file exists
✓ GITHUB_TOKEN ✓
✓ GITHUB_OWNER ✓
✓ GITHUB_REPO ✓
✓ GITHUB_PROJECT_NUMBER ✓
✓ GITHUB_OWNER_TYPE ✓
✓ TELEGRAM_BOT_TOKEN ✓
✓ LOCAL_TELEGRAM_CHAT_ID ✓
✓ MONGO_URI ✓
✓ JWT_SECRET ✓
✓ ADMIN_USER_ID ✓
✓ app.config.js ownerTelegramChatId set

  12 passed, 0 failed

📋 Vercel Environment
──────────────────────────────────────────────────────────────────────
✓ Vercel project linked
✓ GITHUB_TOKEN in Vercel ✓
✓ GITHUB_OWNER in Vercel ✓
✓ GITHUB_REPO in Vercel ✓
✓ GITHUB_PROJECT_NUMBER in Vercel ✓
✓ GITHUB_OWNER_TYPE in Vercel ✓
✓ TELEGRAM_BOT_TOKEN in Vercel ✓
✓ MONGO_URI in Vercel ✓
✓ JWT_SECRET in Vercel ✓
✓ ADMIN_USER_ID in Vercel ✓

  10 passed, 0 failed

📋 GitHub Repository
──────────────────────────────────────────────────────────────────────
✓ GitHub CLI (gh) installed
✓ GitHub CLI authenticated
✓ Secret: TELEGRAM_BOT_TOKEN ✓
✓ Secret: TELEGRAM_CHAT_ID ✓
✓ Secret: PROJECT_TOKEN ✓
✓ Variable: TELEGRAM_NOTIFICATIONS_ENABLED ✓
✓ Variable: PROJECT_OWNER ✓
✓ Variable: PROJECT_REPO ✓
✓ Variable: PROJECT_NUMBER ✓
✓ Variable: PROJECT_OWNER_TYPE ✓
✓ Workflow permissions: read-write ✓

  11 passed, 0 failed

📋 Token Permissions
──────────────────────────────────────────────────────────────────────
✓ GITHUB_TOKEN repo access ✓
✓ GITHUB_TOKEN project access ✓
    Can access project: "Your Project Name"
✓ GITHUB_BOT_TOKEN repo access ✓
✓ GITHUB_BOT_TOKEN authenticated as: your-bot-username ✓
    PRs will be created by this account (allowing admin to approve)

  4 passed, 0 failed

📋 GitHub Project
──────────────────────────────────────────────────────────────────────
✓ GitHub Project configuration present
    Project: your-username/projects/3
✓ Review Status field has all 6 options ✓
✓ Implementation Phase field exists ✓ (multi-PR workflow enabled)

  3 passed, 0 failed

══════════════════════════════════════════════════════════════════════

📊 Overall: 43/43 checks passed

✅ All checks passed! Your setup is ready.
```

**If checks fail:**
- The script will show exactly what's missing and how to fix it
- Each failed check includes remediation steps
- Fix the issues and re-run `yarn verify-setup`

**Skip specific checks:**
```bash
yarn verify-setup --skip-github    # Skip GitHub repo checks (no gh CLI required)
yarn verify-setup --skip-vercel    # Skip Vercel checks (no vercel CLI required)
```

**Once all checks pass, proceed with manual testing below to verify end-to-end functionality.**

---

### 6.1: Test GitHub API Access

Verify your GitHub token has access to the repository:

```bash
yarn github-pr list --state all --limit 1
```

**Expected output:** List of PRs (or empty if no PRs exist)

**If this fails:**
- Check that `GITHUB_TOKEN` in `.env` has correct scopes (`repo`, `project`)
- Verify `GITHUB_OWNER` and `GITHUB_REPO` are correct
- Ensure you're authenticated: `gh auth login`

### 6.2: Test Telegram Notifications

Send a test notification to verify Telegram bot setup:

```bash
yarn send-telegram "Test notification from my-project"
```

**Expected output:** Message appears in your Telegram chat with the bot

**If this fails:**
- Check `TELEGRAM_BOT_TOKEN` in `.env` is correct
- Verify `LOCAL_TELEGRAM_CHAT_ID` matches the chat ID from `yarn telegram-setup`
- Make sure you've started a chat with your bot in Telegram

### 6.3: Test Telegram Webhook

Verify the webhook is configured (do this after deployment):

```bash
yarn telegram-webhook info
```

**Expected output:**
```json
{
  "url": "https://your-app.vercel.app/api/telegram-webhook",
  "has_custom_certificate": false,
  "pending_update_count": 0
}
```

**If this fails:**
- Run `yarn telegram-webhook set https://your-app.vercel.app/api/telegram-webhook`
- Replace with your actual Vercel URL
- Verify your app is deployed and accessible

### 6.4: Full Integration Test

Test the complete workflow end-to-end:

1. **Submit a feature request** via your app UI:
   - Log in as admin (set `ADMIN_USER_ID` in `.env`)
   - Navigate to Feature Requests page
   - Click "Request Feature"
   - Fill out the form and submit

2. **Check Telegram notification**:
   - You should receive a notification with feature details
   - Notification should have an **"Approve & Create GitHub Issue"** button

3. **Tap "Approve" button**:
   - The message should update to show "✅ Approved"
   - A GitHub issue should be created in your repository
   - Issue should be labeled `feature-request`
   - Issue should be added to your GitHub Project in "Backlog" status

4. **Check routing notification**:
   - You should receive a second notification asking where to route the item
   - Options: Product Design, Tech Design, Ready for development, Backlog

5. **Tap a routing button** (e.g., "Product Design"):
   - The item should move to that status in GitHub Projects
   - MongoDB status should update to `in_progress`

6. **Run the appropriate agent**:
   ```bash
   yarn github-workflows-agent --product-design --stream
   ```
   - Agent should process the item
   - Agent should update the issue body with the design
   - Review Status should be set to "Waiting for Review"
   - You should receive a Telegram notification

7. **Tap "Approve" in Telegram**:
   - Item should auto-advance to next phase (Technical Design)
   - Review Status should be cleared

8. **Continue through the workflow**:
   - Repeat steps 6-7 for each phase
   - Implementation agent will create a PR
   - Merge the PR manually on GitHub
   - GitHub Action should auto-mark the item as Done
   - MongoDB status should update to `done`

**If any step fails**, see the [Troubleshooting](#troubleshooting) section.

### 6.5: Quick Button Test

Before the full workflow test, verify Telegram buttons work correctly:

1. **Create a test GitHub issue**:
   ```bash
   gh issue create --title "test: workflow verification" --body "Testing webhook buttons"
   ```

2. **Manually send a test notification** (simulates what the workflow does):
   - Go to your app's `/admin/reports` page (or similar admin interface)
   - Or use the Telegram bot directly to send a message with buttons

3. **Expected result**:
   - Message appears in Telegram WITH buttons (not just text)
   - Tapping a button updates the message or triggers an action
   - No "webhook not set" or "405 error" messages appear

4. **If buttons don't appear**:
   - Verify webhook is set: `yarn telegram-webhook info`
   - Should show your production URL (not localhost)
   - Re-set webhook if needed: `yarn telegram-webhook set https://your-app.vercel.app/api/telegram-webhook`

> **💡 Tip:** Buttons only work with your production deployment (Vercel URL). They won't work with localhost during development.

### 6.6: Verification Scripts

After deployment, use these two scripts to verify your setup:

#### Test 1: Verify Credentials (Local)

Test that your local credentials work correctly:

```bash
yarn verify-credentials
```

**What it tests:**
- ✅ Environment variables in `.env.local`
- ✅ GitHub API access (repo, issues, projects)
- ✅ Telegram bot token validity
- ✅ Webhook configuration
- ✅ Sends test Telegram message

**Expected output:**
```
🔍 Verifying Local Credentials
══════════════════════════════════════════════════════════════════════

📋 Environment Variables
──────────────────────────────────────────────────────────────────────
✓ GITHUB_TOKEN ✓
✓ GITHUB_OWNER ✓
...
  10 passed, 0 failed

🐙 GitHub API
──────────────────────────────────────────────────────────────────────
✓ Repository access works
✓ Issues API works
✓ GitHub Project access works (Your Project Name)
  4 passed, 0 failed

📱 Telegram API
──────────────────────────────────────────────────────────────────────
✓ Bot token valid (@your_bot)
✓ Webhook is configured
✓ Test message sent successfully
  5 passed, 0 failed

✅ All checks passed! 19/19
```

#### Test 2: Verify Production Deployment

Test the actual deployed app on Vercel:

```bash
yarn verify-production --url https://your-app.vercel.app
```

**What it tests:**
- ✅ Vercel project is linked
- ✅ All environment variables set in Vercel production
- ✅ Production app is accessible
- ✅ Webhook endpoint exists and responds

**Expected output:**
```
🔍 Verifying Production Deployment
══════════════════════════════════════════════════════════════════════

📍 Testing: https://your-app.vercel.app

📦 Vercel Project
──────────────────────────────────────────────────────────────────────
✓ Vercel project linked
  1 passed, 0 failed

🔐 Vercel Environment Variables (Production)
──────────────────────────────────────────────────────────────────────
✓ Vercel CLI accessible
✓ GITHUB_TOKEN in Vercel ✓
✓ GITHUB_OWNER in Vercel ✓
...
  10 passed, 0 failed

🌐 Production Deployment
──────────────────────────────────────────────────────────────────────
✓ Production app accessible
✓ Webhook endpoint exists
  2 passed, 0 failed

✅ All checks passed! 13/13
```

**If any checks fail**, see the [Troubleshooting](#troubleshooting) section for specific fixes.

---

## Troubleshooting

### Setup-Specific Issues

**"Buttons appear but clicking does nothing"**
- **Cause:** Webhook handler missing route format support
- **Fix:** Ensure you have the latest template code for `/api/telegram-webhook.ts`
- **Verification:** Check Vercel deployment logs when clicking button

**"Pushed env vars to wrong Vercel project"**
- **Cause:** Used wrong project ID (common with multiple template projects)
- **Impact:** Overwrote another project's Telegram/GitHub configuration
- **Fix:**
  1. Get correct project IDs for both projects
  2. Restore the overwritten project's env vars
  3. Push to correct project with verified project ID
- **Prevention:** Always run `yarn vercel-cli project` to verify BEFORE pushing

**"Have both .env and .env.local with different values"**
- **Cause:** Confusion about which file scripts read
- **Impact:** Scripts may use wrong token/credentials
- **Fix:** Use `.env.local` as single source of truth, delete `.env` or keep it as example only
- **Verification:** `cat .env.local | grep GITHUB_TOKEN` should show your actual token

**"PROJECT_TOKEN in .env files"**
- **Cause:** Confusion about where PROJECT_TOKEN is needed
- **Fix:** Remove `PROJECT_TOKEN` from `.env` and `.env.local` - it's ONLY needed as a GitHub Actions secret name (same value as GITHUB_TOKEN)
- **Clarification:**
  - Local development: uses `GITHUB_TOKEN` from `.env.local`
  - GitHub Actions: uses `PROJECT_TOKEN` secret (which contains the same token)

**"GitHub token works for PRs but not for Projects"**
- **Cause:** Token missing `project` scope
- **Fix:** Generate new token with BOTH `repo` and `project` scopes
- **Verification:** `yarn verify-setup` will catch this

**"Almost overwrote template webhook while testing"**
- **Cause:** Testing with template bot token instead of project-specific bot
- **Prevention:** ALWAYS create a new bot for each project (see Step 3 warning)
- **If this happens:** Restore template webhook immediately:
  ```bash
  yarn telegram-webhook set https://template-domain.vercel.app/api/telegram-webhook
  ```

### GitHub API Issues

**Error: "GITHUB_TOKEN environment variable is required"**
- Add `GITHUB_TOKEN` to your `.env.local` file
- Verify the token is valid (not expired)

**Error: "Project not found"**
- Check `GITHUB_PROJECT_NUMBER` matches the number in the project URL
- Verify `GITHUB_OWNER_TYPE` is correct (`user` vs `org`)
- Ensure your token has `project` scope

**Error: "Status field not found in project"**
- Create the Status field in your GitHub Project
- Verify all required status values exist (see Step 1)
- Status values must match exactly (case-sensitive)

**Error: "Review Status field not found"**
- Create the custom "Review Status" field (see Step 1)
- Field name must be exactly "Review Status"

**Error: "Unknown review status: Waiting for Clarification"**
- One or more review status options are missing from your GitHub Project
- All 6 options are required (see Step 1 for the full list)
- Go to your project → Edit "Review Status" field → Add missing options
- Common mistake: Only adding the first 4 options (missing "Waiting for Clarification" and "Clarification Received")

### Token Permission Issues

**"GITHUB_TOKEN project access ✗" in verify-setup**
- **Cause:** Token is missing the `project` scope
- **For Classic PAT:** Go to token settings → ensure `project` checkbox is checked
- **For Fine-grained PAT:** Go to token settings → Account permissions → Projects: Read and write
- **Important:** Fine-grained PATs have "Projects" under **Account permissions**, NOT Repository permissions (common mistake)

**"Could not resolve to a ProjectV2 with the number X"**
- **Cause 1:** Token doesn't have `project` scope
- **Cause 2:** Wrong project number in `GITHUB_PROJECT_NUMBER`
- **Cause 3:** Wrong owner type (`user` vs `org`)
- **Fix:** Run `yarn verify-setup` to see detailed Token Permissions diagnostics

**PR merge workflow fails in GitHub Actions but works locally**
- **Cause:** The `PROJECT_TOKEN` secret in GitHub Actions has different permissions than local `GITHUB_TOKEN`
- **Fix:**
  1. Generate a new token with both `repo` AND `project` scopes
  2. Update local `.env.local` with new token
  3. Update GitHub Actions secret: `gh secret set PROJECT_TOKEN --body "ghp_your_new_token"`
  4. Run `yarn verify-setup` to confirm both local and remote tokens work

**How to test token permissions manually:**
```bash
# Test repo access
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: bearer YOUR_TOKEN" \
  https://api.github.com/repos/OWNER/REPO
# Should return: 200

# Test project access (replace OWNER and PROJECT_NUMBER)
curl -s -H "Authorization: bearer YOUR_TOKEN" \
  -X POST -d '{"query":"query { user(login: \"OWNER\") { projectV2(number: PROJECT_NUMBER) { id title } } }"}' \
  https://api.github.com/graphql
# Should return project data, not errors
```

### Telegram Issues

**Not receiving notifications**
- Verify `TELEGRAM_BOT_TOKEN` in `.env.local` is correct
- Check `ownerTelegramChatId` in `src/app.config.js` matches your chat ID
- Ensure you've started a chat with your bot
- Test with `yarn send-telegram "test"`

**Button callbacks not working**
- Verify webhook is set: `yarn telegram-webhook info`
- Webhook URL must match your deployed app URL
- App must be deployed and accessible (not localhost)
- Check Vercel deployment logs for errors

**Message: "Webhook requires HTTPS"**
- Telegram webhooks only work with HTTPS URLs
- Use your Vercel production URL (automatically HTTPS)
- For local testing, buttons are replaced with text links

### Telegram Forum Topics Issues

**`yarn telegram-setup` doesn't receive messages from forum topics**
- **Cause 1:** Bot privacy mode is enabled
  - **Fix:** Message @BotFather → `/mybots` → Select bot → Bot Settings → Group Privacy → Turn OFF
  - **Important:** Remove and re-add the bot to the group after changing this setting
- **Cause 2:** Bot is not an admin in the forum group
  - **Fix:** In the group, tap bot name → Promote to Admin → Enable "Manage Topics"
- **Cause 3:** `allowed_updates` filter is blocking messages
  - **Diagnosis:**
    ```bash
    TOKEN=$(grep "^TELEGRAM_BOT_TOKEN" .env.local | cut -d'=' -f2 | tr -d '"')
    curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | jq '.result.allowed_updates'
    ```
  - If it only shows `["callback_query"]`, messages are blocked
  - **Fix:** Reset the filter:
    ```bash
    curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
      -H "Content-Type: application/json" \
      -d '{"url":"","allowed_updates":["message","callback_query","channel_post","edited_message"]}'
    ```

**Bot token returns 404 (Not Found)**
- **Cause:** Token is invalid or bot was deleted
- **Fix:** Get fresh token from @BotFather → `/mybots` → Select bot → API Token
- **Verification:**
  ```bash
  TOKEN="your_token_here"
  curl -s "https://api.telegram.org/bot${TOKEN}/getMe" | jq '.ok'
  # Should return: true
  ```

**Notifications go to wrong topic / don't go to topics at all**
- **Cause:** Missing thread ID in chat ID format
- **Fix:** Use combined format `chatId:threadId` (e.g., `-1001234567890:14`)
- **Verification:** Check your `.env.local`:
  ```bash
  grep TELEGRAM_CHAT_ID .env.local
  # Should show format like: -1001234567890:14
  ```

**Can't use `GITHUB_TELEGRAM_CHAT_ID` as GitHub Actions secret**
- **Cause:** GitHub blocks all secrets starting with `GITHUB_` prefix
- **Fix:** Use `GH_TELEGRAM_CHAT_ID` instead
- The workflows already support this name with fallback to `TELEGRAM_CHAT_ID`

### Agent Issues

**Agent timeout**
- Increase timeout: `--timeout 900` (15 minutes)
- Check your API rate limits on Anthropic
- Verify `ANTHROPIC_API_KEY` or other AI provider keys are set

**Agent skips items**
- Check that Review Status is empty (agents skip items with non-empty Review Status)
- Verify the item is in the correct Status for that agent:
  - Product Design agent → Status = "Product Design"
  - Tech Design agent → Status = "Technical Design"
  - Implementation agent → Status = "Ready for development"

**Git conflicts during implementation**
- Ensure working directory is clean before running agent
- Agents create fresh branches from main/default branch
- If conflicts occur, manually resolve and push

### Vercel Deployment Issues

**Environment variables not working**
- Check that variables are set in `.env.local` for local development
- For Vercel: verify variables are set for the correct environment (Production/Preview/Development)
- Redeploy after adding variables: `vercel --prod`
- Verify variables in Vercel dashboard: Settings → Environment Variables

**Webhook endpoint returning 404**
- Verify `/api/telegram-webhook.ts` file exists in your `pages/api/` directory
- Check Vercel deployment logs for errors
- Ensure the file is included in your deployment (not in `.vercelignore`)

### GitHub Status Integration Issues (Production)

**GitHub statuses show as empty in production (feature-request page)**

This is a **common production deployment issue** caused by missing GitHub environment variables in Vercel.

**Symptoms:**
- Feature request page shows no GitHub statuses in production
- Local development works fine, production doesn't
- GitHub workflows agents work locally but fail in production

**Root Cause:**
Vercel production is missing one or more of these required environment variables:
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_PROJECT_NUMBER`
- `GITHUB_OWNER_TYPE`

**Fix:**

1. **Verify what's set in Vercel production:**
   ```bash
   yarn vercel-cli env --target production | grep GITHUB_
   ```

2. **Push missing variables to Vercel:**
   ```bash
   # Option A: Push all variables from .env.local
   yarn vercel-cli env:push --target production --overwrite

   # Option B: Push only GitHub variables
   # Create a temporary file with just GitHub vars:
   cat > .env.github << EOF
   GITHUB_OWNER=your_username
   GITHUB_REPO=your_repo
   GITHUB_PROJECT_NUMBER=3
   GITHUB_OWNER_TYPE=user
   EOF

   # Push to production
   yarn vercel-cli env:push --file .env.github --target production

   # Clean up
   rm .env.github
   ```

3. **Verify variables were added:**
   ```bash
   yarn vercel-cli env --target production | grep GITHUB_
   ```

   You should see **at least 5 required GitHub variables**:
   - `GITHUB_TOKEN` (required)
   - `GITHUB_BOT_TOKEN` (optional but recommended - for bot account)
   - `GITHUB_OWNER` (required)
   - `GITHUB_REPO` (required)
   - `GITHUB_PROJECT_NUMBER` (required)
   - `GITHUB_OWNER_TYPE` (required)

4. **Trigger a redeploy** (environment variables only take effect after redeployment):
   ```bash
   # Option A: Empty commit
   git commit --allow-empty -m "chore: trigger redeploy for env vars"
   git push

   # Option B: Use Vercel CLI
   vercel --prod
   ```

5. **Wait for deployment to complete**, then test the feature-request page in production.

**Why this happens:**
- The app gracefully handles missing GitHub configuration by returning null statuses
- This prevents errors but makes it hard to debug
- The system requires ALL 5 GitHub variables to connect to GitHub Projects
- Missing even one variable causes `getProjectConfig()` to throw an error

**Prevention:**
- Always run `yarn vercel-cli env:push` after cloning/forking the template
- Verify all GitHub variables are set before deploying
- Keep `.env.local` and Vercel environment variables in sync

### MongoDB Issues

**Cannot connect to database**
- Verify `MONGO_URI` in `.env.local` is correct
- Check that your IP is whitelisted in MongoDB Atlas (Network Access)
- Ensure database name in `src/app.config.js` matches your MongoDB database

### Common Pitfalls

**Using template fallback values**
- The config now fails-fast if env vars are missing
- Don't rely on defaults (`gileck`, `app-template-ai`) - they're removed
- Set all required env vars explicitly in `.env.local`

**Sharing Telegram bot between projects**
- Each project needs its own bot (webhook limitation)
- Create a new bot for each child project
- Takes only ~2 minutes via BotFather

**Forgetting to set webhook**
- Webhook must be set AFTER deployment
- Run `yarn telegram-webhook set <url>` with your production URL
- Verify with `yarn telegram-webhook info`

**Missing GitHub Action workflow permissions**
- Auto-completion won't work without write permissions
- Settings → Actions → General → "Read and write permissions"

---

## Next Steps

After completing setup:

1. **Familiarize yourself with the workflow**:
   - Read [docs/github-projects-integration.md](./github-projects-integration.md)
   - Understand the 6-column workflow
   - Learn about Review Status sub-states

2. **Test the agents**:
   - Submit a real feature request
   - Walk through the full workflow
   - Try requesting changes and see how agents handle feedback

3. **Customize for your needs**:
   - Adjust agent prompts in `src/agents/shared/prompts/` (split by phase: product-design.ts, technical-design.ts, implementation.ts, bug-fix.ts)
   - Configure Claude model/timeout in `src/agents/shared/config.ts`
   - Add custom labels or routing options

4. **Understand agent execution** (IMPORTANT):

   ⚠️ **Agents are MANUAL-ONLY by default** - they do not run automatically.

   You must manually run:
   ```bash
   yarn github-workflows-agent --all
   ```

   **To set up automation** (optional):
   - Run agents via cron: `0 * * * * cd /path/to/repo && yarn github-workflows-agent --all`
   - Set up CI/CD to run agents on schedule
   - Configure auto-merge for approved PRs (use at your own risk)

   See [Running Agents](./github-projects-integration.md#running-agents-manually-vs-automation) for details.

---

## Summary Checklist

Before going live, verify:

- [ ] `.env.example` copied to `.env.local` and filled with actual values
- [ ] GitHub Project V2 created with correct statuses and Review Status field
- [ ] All environment variables set in `.env.local`
- [ ] GitHub token has `repo` and `project` scopes
- [ ] Telegram bot created and chat ID obtained
- [ ] Telegram webhook set to production URL
- [ ] GitHub repository secrets and variables configured
- [ ] Workflow permissions enabled (read and write)
- [ ] Vercel environment variables pushed
- [ ] All tests passing (GitHub API, Telegram, webhook)
- [ ] Full integration test completed successfully
- [ ] `ownerTelegramChatId` updated in `src/app.config.js`

Once all items are checked, you're ready to use the GitHub Projects workflow!

---

## Additional Resources

- [GitHub Projects Integration](./github-projects-integration.md) - Detailed workflow documentation
- [Telegram Notifications](./telegram-notifications.md) - Telegram setup and notification system
- [GitHub PR CLI Tool](../CLAUDE.md#github-pr-cli-tool) - Managing PRs from command line
- [Vercel CLI Tool](../CLAUDE.md#vercel-cli-tool) - Managing Vercel deployments

## Support

If you encounter issues not covered in this guide:

1. Check the [GitHub Projects Integration](./github-projects-integration.md) docs for detailed explanations
2. Review the source code in `src/server/project-management/` and `src/agents/`
3. Open an issue in the template repository with details of your setup and error messages
