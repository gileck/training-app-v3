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

## Prerequisites

Before starting, ensure you have:

- [ ] A GitHub account
- [ ] A repository (forked/cloned from this template)
- [ ] Node.js and yarn installed
- [ ] GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
- [ ] A Telegram account (for notifications)
- [ ] A Vercel account (for deployment)

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

1. In your project, click the **"+"** button (add field)
2. Select **"Single select"**
3. Name it exactly: `Review Status`
4. Add these **exact** options:
   - `Waiting for Review`
   - `Approved`
   - `Request Changes`
   - `Rejected`
   - `Waiting for Clarification`
   - `Clarification Received`
5. Click **"Save"**

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

Your GitHub token needs **two critical scopes**: `repo` and `project`.

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

### Step 3.2: Get Your Chat ID

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

---

## Step 4: GitHub Repository Secrets & Variables

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

| Secret Name | Value | Source |
|-------------|-------|--------|
| `TELEGRAM_BOT_TOKEN` | Your bot token | From BotFather (Step 3.1) |
| `TELEGRAM_CHAT_ID` | Your chat ID | From `yarn telegram-setup` (Step 3.2) |
| `PROJECT_TOKEN` | Your GitHub token | Same as `GITHUB_TOKEN` in `.env` |

**Repository Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `TELEGRAM_NOTIFICATIONS_ENABLED` | `true` | Enables GitHub Actions notifications |
| `GITHUB_OWNER` | `your-username` | Your GitHub username or org |
| `GITHUB_REPO` | `your-repo-name` | Your repository name |
| `GITHUB_PROJECT_NUMBER` | `1` | Your project number |
| `GITHUB_OWNER_TYPE` | `user` | `user` or `org` |

### Enable Workflow Permissions

For auto-completion to work when PRs are merged:

1. Go to **Settings → Actions → General**
2. Under **"Workflow permissions"**, select:
   - ✅ **"Read and write permissions"**
3. Click **"Save"**

---

## Step 5: Vercel Environment Variables

Push your environment variables to Vercel so the deployed app can access them.

**⚠️ CRITICAL:** GitHub status integration in production requires ALL 5 GitHub environment variables to be set in Vercel:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_PROJECT_NUMBER`
- `GITHUB_OWNER_TYPE`

Missing even one variable will cause GitHub statuses to show as empty in the feature-request page.

### Option 1: Using Vercel CLI (Recommended)

1. Install and link Vercel (if not already):
   ```bash
   npm i -g vercel
   vercel link
   ```

2. Push environment variables from `.env.local`:
   ```bash
   yarn vercel-cli env:push --file .env.local --target production --overwrite
   ```

   This will push all variables from `.env.local` to production.

3. **Verify all GitHub variables were pushed:**
   ```bash
   yarn vercel-cli env --target production | grep GITHUB_
   ```

   **Expected output** (all 5 variables):
   ```
   📝 GITHUB_TOKEN                   = [hidden]
   📝 GITHUB_OWNER                   = [hidden]
   📝 GITHUB_REPO                    = [hidden]
   📝 GITHUB_PROJECT_NUMBER          = [hidden]
   📝 GITHUB_OWNER_TYPE              = [hidden]
   ```

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

4. **GitHub Project**
   - Project configuration present (manual verification recommended)

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
✓ Variable: GITHUB_OWNER ✓
✓ Variable: GITHUB_REPO ✓
✓ Variable: GITHUB_PROJECT_NUMBER ✓
✓ Variable: GITHUB_OWNER_TYPE ✓
✓ Workflow permissions: read-write ✓

  11 passed, 0 failed

📋 GitHub Project
──────────────────────────────────────────────────────────────────────
✓ GitHub Project configuration present
    Project: gileck/projects/3
    Manual verification recommended

  1 passed, 0 failed

══════════════════════════════════════════════════════════════════════

📊 Overall: 34/34 checks passed

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

---

## Troubleshooting

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

   You should see **all 5 GitHub variables**:
   - `GITHUB_TOKEN`
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_PROJECT_NUMBER`
   - `GITHUB_OWNER_TYPE`

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
   - Adjust agent prompts in `src/agents/shared/prompts.ts`
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
