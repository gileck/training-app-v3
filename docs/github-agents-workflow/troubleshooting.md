# GitHub Agents Workflow - Troubleshooting

This guide covers common issues and solutions for the GitHub Projects automation workflow.

## Setup Verification

Run this command to verify your setup:

```bash
yarn verify-setup
```

This checks:
- ✅ GitHub token permissions (Issues, Projects, Pull Requests, Workflows)
- ✅ GitHub Project ID environment variables
- ✅ Telegram bot configuration
- ✅ Vercel webhook configuration
- ✅ Agent workflow files and dependencies

## Common Issues

### 1. GitHub Token Errors

**Problem:** `Error creating issue: Bad credentials` or `403 Forbidden`

**Solutions:**

#### a) Token Expired
- GitHub fine-grained tokens expire after 90 days
- Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
- Regenerate token and update `.env` and Vercel

#### b) Insufficient Permissions
Token needs these permissions:
- **Issues**: Read and write
- **Metadata**: Read-only (automatically granted)
- **Projects**: Read and write
- **Pull requests**: Read and write
- **Workflows**: Read and write

#### c) Wrong Repository Access
- Fine-grained tokens are scoped to specific repositories
- Verify token has access to your repository
- If using multiple repos, regenerate with correct access

#### d) Token Not in Vercel
```bash
# Push to Vercel (from linked project)
yarn vercel-cli env:push GITHUB_TOKEN --overwrite

# Verify
yarn vercel-cli env:list
```

### 2. Project ID Issues

**Problem:** `Project not found` or `Cannot read property 'id' of undefined`

**Solutions:**

#### a) Missing PROJECT_ID Environment Variable
```bash
# Get your Project ID
yarn github-project-id

# Add to .env
PROJECT_ID=PVT_kwHOABCDEF1234567890

# Push to Vercel
yarn vercel-cli env:push PROJECT_ID --overwrite
```

#### b) Wrong Project ID Format
- Must be the **Project ID** (starts with `PVT_`), not the project number
- Get it from: `https://github.com/users/YOUR_USERNAME/projects/NUMBER/settings`
- Or use: `yarn github-project-id`

### 3. Agent Not Creating Issues/PRs

**Problem:** Agent runs but doesn't create GitHub issues or pull requests

**Checklist:**

#### a) Verify Environment Variables
```bash
# Check locally
cat .env | grep GITHUB

# Check on Vercel
yarn vercel-cli env:list
```

Required variables:
- `GITHUB_TOKEN` - Fine-grained token with proper permissions
- `PROJECT_ID` - GitHub Project V2 ID (starts with `PVT_`)
- `BACKLOG_STATUS` - Project status column ID (starts with `f_`)
- `PRODUCT_DESIGN_STATUS` - Project status column ID
- `TECH_DESIGN_STATUS` - Project status column ID
- `READY_FOR_DEV_STATUS` - Project status column ID
- `PR_REVIEW_STATUS` - Project status column ID
- `DONE_STATUS` - Project status column ID

#### b) Check Agent Logs
```bash
# View recent logs
yarn vercel-cli logs --deployment dpl_xxx

# Filter for agent errors
yarn vercel-cli logs --deployment dpl_xxx | grep -i "error"
```

#### c) Test Agent Manually
```bash
# Run agent locally (from agents-copy)
cd ../app-template-ai-agents
yarn agent:implement --feature-id <id>
```

### 4. Telegram Webhook Not Working

**Problem:** Admin approval buttons don't work or webhook returns errors

**Solutions:**

#### a) Verify Webhook URL
```bash
# Get current webhook
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo

# Should show: https://your-app.vercel.app/api/telegram-webhook
```

#### b) Set Webhook URL
```bash
# Use correct production URL
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-app.vercel.app/api/telegram-webhook"}'
```

#### c) Check Webhook Errors
- Telegram API → Recent webhook errors shown in `getWebhookInfo`
- Vercel logs → Check `/api/telegram-webhook` function logs

#### d) Verify Callback Data Format
Callback data must be URL-safe and under 64 bytes:
```typescript
// Correct format
callback_data: `approve_${shortId}_${type}`

// Wrong - too long or has special characters
callback_data: `approve_feature_12345678-1234-1234-1234-123456789012`
```

### 5. PR Merge Webhook Not Triggering

**Problem:** PR merged on GitHub but item not marked as Done

**Solutions:**

#### a) Verify GitHub Webhook Configured
Go to: Repository → Settings → Webhooks
- Payload URL: `https://your-app.vercel.app/api/github-webhook`
- Content type: `application/json`
- Events: "Let me select individual events" → ✅ Pull requests
- Active: ✅ Enabled

#### b) Check Recent Deliveries
- Repository → Settings → Webhooks → Edit webhook → Recent Deliveries
- Look for failed deliveries with error messages

#### c) Verify PR Has Correct Metadata
PR must include in description:
```
<!-- feature-id: 507f1f77bcf86cd799439011 -->
```

#### d) Check Webhook Handler Logs
```bash
yarn vercel-cli logs | grep "github-webhook"
```

### 6. Multi-Phase Feature Issues

**Problem:** Phase detection not working or wrong phase in PR

**Solutions:**

#### a) Verify Phase Comment Exists
- Open the GitHub issue
- Look for comment with `<!-- AGENT_PHASES_V1 -->`
- Comment should have deterministic format:
```markdown
## Implementation Phases

<!-- AGENT_PHASES_V1 -->

### Phase 1: [Title] (Size: S/M)
Description...

### Phase 2: [Title] (Size: S/M)
Description...
```

#### b) Check PR Description
PR must include:
```
**Phase:** 1 of 3
```

#### c) PR Review Agent Phase Awareness
- Agent reads phase from PR description
- Compares implementation against ONLY that phase
- Use `--phase 1` flag when running manually

### 7. Status Not Updating in GitHub Projects

**Problem:** Item created but doesn't move to correct column

**Solutions:**

#### a) Verify Status IDs
```bash
# Get your status field IDs
yarn github-project-status-ids

# Should output all status column IDs
```

#### b) Check Status Update Logs
```bash
yarn vercel-cli logs | grep "updateStatus"
```

#### c) Verify Status Names Match
Status names in GitHub Projects must EXACTLY match:
- "Backlog"
- "Product Design"
- "Technical Design"
- "Ready for development"
- "PR Review"
- "Done"

### 8. Design PR Not Auto-Merging

**Problem:** Admin approves design PR via Telegram but PR doesn't merge

**Solutions:**

#### a) Check PR Checks Status
- PR must pass all checks before auto-merge
- GitHub → PR → Checks tab
- Wait for all checks to complete

#### b) Verify Branch Protection Rules
If branch protection enabled:
- Require status checks to pass: ✅
- Require branches to be up to date: ❌ (disable this)

#### c) Check Merge Logs
```bash
yarn vercel-cli logs | grep "mergePR"
```

### 9. Child Project Sync Issues

**Problem:** Agents-copy not syncing properly or getting out of date

**Solutions:**

#### a) Re-initialize Agents Copy
```bash
# From main project
yarn init-agents-copy --force

# Verify sync
cd ../app-template-ai-agents
git status
```

#### b) Manual Sync
```bash
# From main project
rsync -av --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next' \
  --exclude '.vercel' \
  src/agents/ ../app-template-ai-agents/src/agents/

cd ../app-template-ai-agents
yarn install
```

#### c) Check Symlink (if using)
```bash
# Verify symlink exists
ls -la ../app-template-ai-agents/src/agents/shared
# Should point to main project's shared folder
```

### 10. Environment Variable Mismatches

**Problem:** Works locally but fails on Vercel

**Solutions:**

#### a) Compare Local vs Production
```bash
# Run verification
yarn verify-production --url https://your-app.vercel.app

# Shows which vars are missing or mismatched
```

#### b) Push All Env Vars
```bash
# Push ALL environment variables to Vercel
yarn vercel-cli env:push --overwrite

# Verify specific variable
yarn vercel-cli env:list | grep GITHUB_TOKEN
```

#### c) Redeploy After Env Changes
```bash
# Trigger new deployment
git commit --allow-empty -m "Trigger redeploy"
git push
```

## Agent-Specific Issues

### Product Design Agent

**Problem:** Design not generated or incomplete

**Solutions:**
- Check if feature request has clear description
- Verify agent has access to repository files
- Review logs for OpenAI/Claude API errors
- Ensure `ANTHROPIC_API_KEY` set in agents-copy `.env`

### Tech Design Agent

**Problem:** Tech design missing or too vague

**Solutions:**
- Verify feature has approved product design
- Check if complexity warrants tech design (not for XS/S items)
- Review agent prompt in `src/agents/tech-design-agent/workflow.ts`
- Ensure agent can read product design file

### Implementation Agent

**Problem:** PR not created or incomplete implementation

**Solutions:**
- Verify previous design phases completed
- Check agent can create branches and push code
- Review Claude Code SDK connection
- For multi-phase: verify phase comment format
- Check `--phase N` parameter passed correctly

### PR Review Agent

**Problem:** Reviews not happening or wrong criteria

**Solutions:**
- Verify cron schedule: `0 */6 * * *` (every 6 hours)
- Check Review Status = "Waiting for Review" in Projects
- For multi-phase features: verify phase number in PR description
- Review agent logs for API errors
- Ensure agent has access to PR files

### 11. GitHub API Rate Limit Errors

**Problem:** Feature Requests page shows "GitHub API rate limit reached" warning, or statuses appear incomplete

**Background:** The Feature Requests page fetches live GitHub Project statuses for all items to ensure accurate filtering. This can hit GitHub API rate limits (5000 requests/hour for authenticated requests).

**Solutions:**

#### a) Check Current Rate Limit Status
```bash
# Check your current rate limit
curl -H "Authorization: token <GITHUB_TOKEN>" \
  https://api.github.com/rate_limit
```

#### b) Wait for Reset
- Rate limits reset hourly
- The page will show a warning banner but continue to function
- Items will fall back to database status for filtering

#### c) Reduce API Calls
- The page uses React Query with 30-second stale time
- Avoid frequent page refreshes
- Consider reducing the number of active (non-Done) items in your project

#### d) Use GitHub Enterprise (if applicable)
- GitHub Enterprise has higher rate limits
- Contact your admin for rate limit increases

**Note:** Rate limit errors are handled gracefully - the page remains functional but may show slightly stale status data. Individual card displays will still fetch their own status.

## Getting Help

If issues persist after trying these solutions:

1. **Run Full Verification:**
   ```bash
   yarn verify-setup
   ```

2. **Check All Logs:**
   ```bash
   # Local development
   yarn dev

   # Production logs
   yarn vercel-cli logs --production
   ```

3. **Review Documentation:**
   - Main guide: `docs/github-projects-integration.md`
   - Setup guide: `docs/init-github-projects-workflow.md`
   - Technical reference: `docs/github-agents-workflow/reference.md`

4. **Test Components Individually:**
   ```bash
   # Test GitHub API
   yarn github-project-id

   # Test Telegram
   yarn telegram-setup

   # Test agent manually
   cd ../app-template-ai-agents
   yarn agent:implement --feature-id <id>
   ```
