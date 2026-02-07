# Running the Agents

This document explains how to run the AI agents, when to run them, the agents copy setup, and how to use execution logs.

## Overview

The workflow includes five AI agents that automate different phases of the development pipeline:

1. **Product Development Agent** (Optional) - Transforms vague ideas into concrete product specs
2. **Product Design Agent** - Generates UX/UI designs and mockups
3. **Tech Design Agent** - Creates technical architecture documents
4. **Implementation Agent** - Writes code and creates PRs
5. **PR Review Agent** - Reviews implementation PRs and generates commit messages

## Running Agents with Agents Copy (Recommended)

Using a separate agents copy is **strongly recommended** to avoid:
- Committing agent changes to your main working directory
- Merge conflicts between your work and agent work
- Losing agent progress when switching branches

### Initial Setup

```bash
# In your main project directory
yarn init-agents-copy

# This creates ../app-template-ai-agents with:
# - Clean git worktree
# - All dependencies installed
# - Ready to run agents
```

The agents copy is a **git worktree** pointing to `main` branch, isolated from your working directory.

### Running Agents from Agents Copy

```bash
# 1. Navigate to agents copy
cd ../app-template-ai-agents

# 2. Pull latest changes from main
git pull origin main

# 3. Run desired agent
yarn agent:product-design
yarn agent:tech-design
yarn agent:implement
yarn agent:pr-review

# 4. Review and push PR created by agent
git push origin [branch-name]
```

### When to Use Agents Copy

✅ **Always use for:**
- Running implementation agent (creates code changes)
- Running design agents (creates design files)
- Any agent that creates PRs

✅ **Optional for:**
- PR review agent (read-only, no commits)
- Testing agents without creating PRs

## Running Agents Directly (Alternative)

You can run agents directly in your main working directory, but be aware of the risks:

```bash
# In main project directory
yarn agent:product-design
yarn agent:tech-design
yarn agent:implement
yarn agent:pr-review
```

⚠️ **Risks:**
- Agent commits mixed with your work
- Potential merge conflicts
- Harder to separate agent work from your work

**Best practice:** Only use this for quick testing or when you're not actively developing.

## Agent Execution Flow

### 1. Product Development Agent (Optional)

**When to run:** Item is in "Product Development" column

**What it does:**
- Reads vague feature ideas from issue description
- Transforms them into concrete product specifications
- Focuses on WHAT to build and WHY (not UI/UX - that's Product Design)
- Creates PR with product development document
- Moves issue to "Product Design" on merge

**Command:**
```bash
yarn agent:product-development

# Or with specific issue:
yarn agent:product-development --issue 123
```

**When to Use:**
- Feature idea is vague or unclear
- Requirements need to be defined before UI/UX design
- Scope boundaries need clarification
- Success metrics need definition

**When to Skip:**
- Feature is already well-defined in the issue
- It's a bug fix (route directly to Tech Design)
- It's internal/technical work

**Output Sections:**
- Size Estimate (S/M/L/XL)
- Problem Statement
- Target Users
- Requirements with acceptance criteria
- Success Metrics
- Scope (in/out of scope)

### 2. Product Design Agent

**When to run:** Item is in "Product Design" column

**What it does:**
- Reads issue description (and Product Development doc if exists)
- Generates UX/UI design document
- Focuses on HOW it will look and feel (mobile-first)
- Creates PR with design file → `docs/designs/[issue-number]-[title].md`
- Moves issue to "Technical Design" on merge

**Command:**
```bash
yarn agent:product-design

# Or with specific issue:
yarn agent:product-design --issue 123
```

**Trigger:**
- Manually: Run command when ready
- Automated: Via cron job (if configured)

### 4. Tech Design Agent

**When to run:** Item is in "Technical Design" column

**What it does:**
- Reads issue + product design (if exists)
- Analyzes codebase structure
- Generates technical architecture document
- For L/XL complexity: Breaks into 2-5 implementation phases
- Creates PR with design file → `docs/designs/tech/[issue-number]-[title].md`
- Moves issue to "Ready for development" on merge

**Command:**
```bash
yarn agent:tech-design

# Or with specific issue:
yarn agent:tech-design --issue 123
```

**Phase Generation (L/XL issues):**
- Agent posts phases as GitHub issue comment
- Uses deterministic format with marker `<!-- AGENT_PHASES_V1 -->`
- Each phase is independently implementable and mergeable
- Implementation agent reads phases from comment

### 5. Implementation Agent

**When to run:** Item is in "Ready for development" column

**What it does:**
- Reads issue + design documents
- **Runs Plan Subagent** (for claude-code-sdk and cursor) to create detailed implementation plan
- For multi-phase: Implements ONLY the current phase
- Writes code following project guidelines
- **Visually verifies UI changes** at 400px viewport (when applicable)
- Creates PR with implementation
- Sets Review Status = "Waiting for Review"

**Command:**
```bash
yarn agent:implement

# Or with specific issue:
yarn agent:implement --issue 123
```

**Plan Subagent (Automatic):**

Before implementing, the agent runs a **Plan Subagent** that:
1. Explores the codebase in read-only mode
2. Generates a detailed step-by-step implementation plan
3. Passes the plan to the main implementation agent

This is **fully encapsulated** - you don't need to configure anything. The plan subagent:
- Uses `--mode=plan` for Cursor
- Uses read-only tools (`Read`, `Glob`, `Grep`, `WebFetch`) for Claude Code SDK
- Has a 2-minute timeout
- If it fails, implementation proceeds without detailed plan

**Visual Verification (UI Changes):**

When implementing UI changes, the agent will:
1. Use Playwright MCP to open the app at `http://localhost:3000`
2. Navigate to the relevant page/component
3. Resize browser to 400px width (mobile viewport)
4. Take screenshots to verify:
   - Layout looks correct on mobile
   - Touch targets are at least 44px
   - No content overflow or horizontal scrolling
   - Dark mode works if applicable

**Visual verification output** is included in the agent's structured output:
```json
{
  "prSummary": "...",
  "comment": "...",
  "visualVerification": {
    "verified": true,
    "whatWasVerified": "Tested at 400px viewport, verified touch targets, checked dark mode",
    "issuesFound": "Fixed button overflow on small screens"
  }
}
```

If Playwright MCP is unavailable:
```json
{
  "visualVerification": {
    "verified": false,
    "skippedReason": "Playwright MCP not available - manual verification needed"
  }
}
```

**Note:** Visual verification is **optional** and only applies to PRs with UI changes. PRs without visual components (backend-only, types, etc.) will not include the `visualVerification` field.

**Phase-Aware Implementation:**
- Automatically detects current phase from GitHub status
- Reads phase details from issue comment (reliable) or markdown (fallback)
- Creates PR title: `feat: [phase X/Y] - description`
- Next phase starts automatically after previous PR merges

### 6. PR Review Agent

**When to run:** PR is open and ready for review

**What it does:**
- Reviews code changes for quality and correctness
- **Phase-aware**: Verifies PR only implements the specified phase
- Generates detailed commit message with co-author attribution
- Saves commit message to PR comment
- Approves PR if passing, requests changes if issues found

**Command:**
```bash
yarn agent:pr-review

# Or with specific PR:
yarn agent:pr-review --pr 123
```

**Automated Execution:**
- Runs via cron job every 15 minutes (configurable)
- Checks all PRs with Review Status = "Waiting for Review"
- Posts review comments and approval/rejection

**Workflow:**
1. Agent reviews PR code
2. Agent generates commit message
3. Agent saves message to PR comment (marker: `<!-- AGENT_COMMIT_MESSAGE -->`)
4. Agent approves PR
5. Admin receives Telegram notification with Merge/Request Changes buttons
6. Merge: Uses saved commit message, squash merges
7. Request Changes: Back to implementor (admin must comment explaining changes)

## Agent Execution Logs

All agent executions are logged to MongoDB for debugging and auditing.

### Log Structure

```typescript
{
  _id: ObjectId,
  agent: 'product-design' | 'tech-design' | 'implement' | 'pr-review',
  issueNumber: number,
  prNumber?: number,
  startedAt: Date,
  completedAt?: Date,
  status: 'running' | 'completed' | 'failed',
  error?: string,
  result?: {
    prUrl?: string,
    branchName?: string,
    commitSha?: string,
    reviewDecision?: 'approved' | 'changes_requested',
    commitMessage?: string
  },
  metadata: {
    complexity?: string,
    phaseCount?: number,
    currentPhase?: number,
    totalPhases?: number
  }
}
```

### Viewing Logs

**Via MongoDB:**
```typescript
import { getAgentLogs } from '@/server/database/collections/agent-logs';

// Get all logs for an issue
const logs = await getAgentLogs({ issueNumber: 123 });

// Get logs for specific agent
const logs = await getAgentLogs({ agent: 'implement' });

// Get recent failures
const logs = await getAgentLogs({ status: 'failed', limit: 10 });
```

**Via CLI (if available):**
```bash
yarn agent:logs --issue 123
yarn agent:logs --agent implement
yarn agent:logs --status failed
```

### Log Use Cases

**1. Debugging Failed Executions**
- Check error message and stack trace
- Review metadata for context
- Identify which phase/step failed

**2. Tracking Agent Performance**
- Execution duration (completedAt - startedAt)
- Success rate by agent type
- Identify bottlenecks

**3. Auditing Agent Actions**
- What did agent create? (PR URL, branch name)
- When did it run? (startedAt timestamp)
- What was the outcome? (status, result)

### Error Handling

**Common Errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `No issues found in column` | Column is empty | Wait for items to reach that phase |
| `GitHub API rate limit` | Too many API calls | Wait for rate limit reset |
| `Missing design document` | Design file not found | Ensure previous phase completed |
| `Git merge conflict` | Branch conflicts with main | Manually resolve conflicts |

**Automatic Retries:**
- Agents automatically retry transient failures (network errors)
- Logs show retry attempts in metadata
- After 3 retries, execution marked as failed

### Best Practices

**1. Monitor Logs Regularly**
- Check for failed executions daily
- Investigate errors promptly
- Review agent performance metrics

**2. Clean Up Old Logs**
- Logs accumulate over time
- Consider archiving logs older than 90 days
- Keep recent logs for active development

**3. Use Logs for Debugging**
- When agent behavior is unexpected, check logs first
- Review metadata for context
- Compare successful vs failed executions

## Cron Job Setup (Optional)

To run agents automatically:

### Vercel Cron Jobs

**1. Create cron configuration (`vercel.json`):**
```json
{
  "crons": [
    {
      "path": "/api/cron/pr-review",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**2. Create cron API endpoint (`src/pages/api/cron/pr-review.ts`):**
```typescript
import { verifyVercelCronRequest } from '@/server/utils/vercel-cron';
import { execSync } from 'child_process';

export default async function handler(req, res) {
  // Verify request is from Vercel Cron
  if (!verifyVercelCronRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Run agent in agents copy
    execSync('cd ../app-template-ai-agents && yarn agent:pr-review', {
      stdio: 'inherit'
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

**3. Deploy to Vercel:**
```bash
git push origin main
# Vercel auto-deploys and sets up cron job
```

### Alternative: GitHub Actions

**Create workflow (`.github/workflows/pr-review.yml`):**
```yaml
name: PR Review Agent
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: yarn install
      - run: yarn agent:pr-review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Troubleshooting

### Agent Doesn't Start

**Check:**
1. Issue is in correct column for agent
2. Previous phase completed (design agents)
3. GitHub API token has correct permissions
4. No running agent for same issue

### Agent Creates Wrong PR

**Check:**
1. Issue description is clear
2. Design documents exist and are correct
3. Agent logs for execution details
4. Phase information is accurate (multi-phase)

### PR Review Agent Doesn't Approve

**Check:**
1. PR has Review Status = "Waiting for Review"
2. PR is linked to issue correctly
3. Code changes follow project guidelines
4. No merge conflicts

## Summary

**Agents Copy Setup:**
- `yarn init-agents-copy` - One-time setup
- Use separate directory to isolate agent work
- Pull latest changes before running

**Running Agents:**
- `yarn agent:product-development` - Transform vague ideas into product specs (optional)
- `yarn agent:product-design` - Generate UX/UI designs
- `yarn agent:tech-design` - Create architecture docs
- `yarn agent:implement` - Write code and create PRs
- `yarn agent:pr-review` - Review PRs (automated via cron)

**Monitoring:**
- Check agent logs in MongoDB
- Review execution status and errors
- Track performance metrics

**See also:**
- [Feedback and Reviews](./feedback-and-reviews.md) - Handling feedback loops and review comments
- [Telegram Integration](./telegram-integration.md) - Telegram notifications and quick actions
