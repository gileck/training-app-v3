# Tasks

Tasks sorted by priority (Critical → High → Medium → Low).

**Format:** All tasks follow the standardized format defined in `TASK_FORMAT.md`.

**Required fields:** Number, Title, Priority, Complexity, Size, Status, Date Added, Summary

---

## 1. ~~Fix Cost Tracking Bug in Implementation Agent~~ ✅ DONE

| Priority | Complexity | Size | Status |
|----------|------------|------|--------|
| **Critical** | Low | XS | ✅ **DONE** |

> **Completed:** 2026-01-24 - Fixed in commit `78c0e44`

**Summary:** The implementation agent passes hardcoded zeros for cost/token tracking instead of actual values from the Claude SDK response.

**Current Bug Location:** `src/agents/core-agents/implementAgent/index.ts:939`

```typescript
// CURRENT (broken):
logExecutionEnd(logCtx, {
    success: true,
    toolCallsCount: 0,        // ← Should be from result.usage
    totalTokens: 0,           // ← Should be from result.usage
    totalCost: 0,             // ← Should be from result.usage
});

// CORRECT:
logExecutionEnd(logCtx, {
    success: true,
    toolCallsCount: result.usage?.toolCallsCount ?? 0,
    totalTokens: result.usage?.totalTokens ?? 0,
    totalCost: result.usage?.totalCostUSD ?? 0,
});
```

**Impact:**
- Agent logs show $0.00 cost for all implementations
- Unable to track actual costs per feature
- Blocks cost budgeting/alerting features

**Files to Modify:**
- `src/agents/core-agents/implementAgent/index.ts` - Fix `logExecutionEnd()` call

---

## 2. ~~Debug PR Reviewer + Claude Integration~~ ✅ DONE

| Priority | Complexity | Size | Status |
|----------|------------|------|--------|
| **High** | Low | S | ✅ **DONE** |

> **Completed:** 2026-01-24 - Fixed in commit `dc3fb4c`

**Summary:** PR Reviewer agent sometimes ignores valid feedback from Claude GitHub App without explanation.

**Solution Implemented:**

The PR Review Agent prompt was updated to require explicit acknowledgment of Claude's feedback. The agent must now include a "Claude Feedback Response" section that states AGREE or DISAGREE for each point Claude raised, with reasoning:

```
### Claude Feedback Response
1. [Claude's point about X] - **AGREE** - Added to changes requested
2. [Claude's point about Y] - **DISAGREE** - This pattern is acceptable because [reason]
```

This ensures Claude's feedback can never be silently ignored - the agent must explicitly respond to each point.

**Files Modified:**
- `src/agents/core-agents/prReviewAgent/createPrReviewerAgentPrompt.ts` - Updated prompt instructions
- `src/agents/core-agents/prReviewAgent/AGENTS.md` - Updated documentation

---

## 3. ~~Add "Ready to Merge" Status with Admin Approval Gate~~ ✅ DONE

| Priority | Complexity | Size | Status |
|----------|------------|------|--------|
| **High** | Mid | M | ✅ **DONE** |

> **Completed:** 2026-01-24 - Implemented in commit `b79fca0`
>
> **Implementation Note:** Implemented differently than originally proposed - instead of a new "Ready to Merge" status with Implementor agent handling merges, we implemented a simpler Telegram-based flow:
> - PR Review Agent generates commit message on approval → saves to PR comment
> - Admin receives Telegram with Merge/Request Changes buttons
> - Merge button squash-merges with the saved commit message
> - Request Changes sends back to implementation
>
> This is simpler (no extra status needed) and more immediate (one-click merge from Telegram).

**Summary:** Add a new workflow status between "PR Review Approved" and "Done" that requires admin approval before merging.

**Current Flow:**
```
PR Review Approved → (auto-merge or manual) → Done
```

**Proposed Flow:**
```
PR Review Approved → Ready to Merge (null/pending) → Admin Approves → Implementor Merges → Done
```

**Implementation Details:**

1. **New Status Field Value:** `Ready to Merge`
   - Triggered after PR Review agent approves the PR
   - Initial state: waiting for admin approval (no action taken yet)

2. **Admin Approval Mechanism:**
   - Admin reviews the approved PR in GitHub Projects board
   - Admin sets a field (e.g., "Merge Approved" checkbox or moves to approved column)
   - Could be a GitHub label, project field, or issue comment trigger

3. **Implementor Merge Flow:**
   - Implementor agent picks up issues with "Ready to Merge" + admin approval
   - **Validation step:** Read latest PR comments to check for any new feedback
   - **Decision point:**
     - If ready: Generate detailed commit message (title + description) and merge
     - If changes needed: Make changes, comment on PR explaining what was changed, request re-review
   - If changes were made → status goes back to "PR Review" (not full cycle)

4. **PR Comment on Re-review:**
   - Implementor comments: "Added changes: [list of changes]. @claude please review only these changes, not the entire PR."

5. **Merge Script Enhancement:**
   - Accept detailed commit message (title + multi-line description)
   - Use squash merge with the provided message

**Files to Modify:**
- `src/server/project-management/types.ts` - Add new status
- `src/agents/core-agents/implementAgent/index.ts` - Add merge validation flow
- `.github/workflows/on-pr-merged.yml` - Update status transitions
- `scripts/on-pr-merged.ts` - Handle new status
- `docs/github-projects-integration.md` - Document new flow

---

## 14. ~~Fix Issue Parsing Summary Section in Issue Log File~~ ✅ DONE

| Priority | Complexity | Size | Status |
|----------|------------|------|--------|
| **High** | Low | S | ✅ **DONE** |

**Date Added:** 2026-01-25

**Summary:** The agent workflow encounters a warning "Found summary section but could not parse table - creating new summary" when processing issue log files like agent-logs/issue-48.md, preventing proper cost tracking updates.

**Files to Modify:**
- `src/agents/lib/logging/index.ts` - Fix summary section table parsing

---

## 4. Add Agent Retry Logic for Transient Failures

| Priority | Complexity | Size |
|----------|------------|------|
| **Medium** | Mid | M |

**Summary:** When agents fail due to timeouts, rate limits, or transient errors, they must be manually re-run. Need automatic retry with backoff.

**Current State:**
- Timeout detected via `AbortController`, but agent exits
- Rate limit errors fail immediately
- No distinction between retryable vs permanent failures

**Implementation Details:**

1. **Classify error types:**
   ```typescript
   type FailureType =
     | 'timeout'      // Retryable with longer timeout
     | 'rate_limit'   // Retryable with exponential backoff
     | 'transient'    // Retryable (network, 5xx)
     | 'permanent';   // Not retryable (4xx, validation)
   ```

2. **Retry configuration:**
   ```typescript
   const retryConfig = {
     maxRetries: 2,
     baseDelayMs: 5000,
     maxDelayMs: 60000,
     timeoutMultiplier: 1.5,  // Increase timeout on retry
   };
   ```

3. **Retry wrapper:**
   ```typescript
   async function withRetry<T>(
     fn: () => Promise<T>,
     config: RetryConfig,
   ): Promise<T> {
     // ... exponential backoff logic
   }
   ```

4. **CLI flag to disable:**
   ```bash
   yarn github-workflows-agent --implement --no-retry
   ```

**Files to Modify:**
- `src/agents/lib/adapters/claude-code-sdk.ts` - Add retry wrapper
- `src/agents/shared/config.ts` - Add retry configuration
- `src/agents/core-agents/*/index.ts` - Wrap execution with retry

---

## 5. Add Stale Item Detection Workflow

| Priority | Complexity | Size |
|----------|------------|------|
| **Medium** | Mid | M |

**Summary:** Items can get stuck in workflow phases indefinitely with no notification. Need automated detection and alerts.

**Problem Statement:**
- No visibility into items that are "stuck" in the pipeline
- Admin has to manually check GitHub Projects board for stale items
- Feedback from reviewers can go unaddressed for weeks
- Feature requests submitted by users may never get synced

**Stale Definitions (Configurable):**

| Status/Phase | Condition | Default Threshold |
|--------------|-----------|-------------------|
| Product Design | "Waiting for Review" | 7 days |
| Tech Design | "Waiting for Review" | 7 days |
| Implementation | "In Progress" no commits | 14 days |
| PR Review | "Request Changes" unaddressed | 7 days |
| PR Review | "Waiting for Review" | 3 days |
| MongoDB Feature Request | `status = "new"` | 30 days |

**Implementation Options:**

**Option A: GitHub Action (Cron) - Recommended**
```yaml
# .github/workflows/stale-detection.yml
name: Detect Stale Items
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am
  workflow_dispatch:  # Manual trigger
jobs:
  detect-stale:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: yarn install --frozen-lockfile
      - run: yarn stale-detection
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
```

**Option B: CLI Command (Manual/Local)**
```bash
yarn stale-detection              # Run detection
yarn stale-detection --dry-run    # Preview without notifications
yarn stale-detection --json       # Output JSON for programmatic use
```

**Detection Logic:**
1. **GitHub Projects Query:**
   - Fetch all items with `Status != "Done"`
   - Check `updatedAt` against thresholds per status
   - For PRs: check last commit date, last review date

2. **MongoDB Query:**
   - Find feature requests with `status = "new"` AND `createdAt < (now - 30 days)`
   - Optionally: items with `status = "approved"` but not synced to GitHub

3. **Output/Actions:**
   - Send Telegram digest with grouped stale items
   - Optionally: Add GitHub label `stale` to issues
   - Optionally: Post comment on stale PRs

**Notification Format:**
```
🔴 Stale Items Report (3 items)

**Waiting for Review (7+ days):**
- #42: Add dark mode - Product Design (12 days)
- #45: Refactor auth - Tech Design (8 days)

**Unaddressed Feedback (7+ days):**
- PR #46: Fix login bug - has 2 unresolved comments (9 days)

**Unsynced Feature Requests (30+ days):**
- "Add export to PDF" - submitted 45 days ago
```

**Configuration:**
```typescript
// In agents.config.ts or .stale-detection.json
const staleConfig = {
  thresholds: {
    waitingForReview: 7,      // days
    requestChanges: 7,
    inProgressNoCommits: 14,
    unsyncedFeatureRequest: 30,
  },
  actions: {
    sendTelegram: true,
    addGitHubLabel: false,
    postPRComment: false,
  },
  schedule: 'weekly',  // or 'daily'
};
```

**Files to Create/Modify:**
- `scripts/stale-detection.ts` - New CLI script
- `.github/workflows/stale-detection.yml` - Cron workflow
- `src/agents/shared/config.ts` - Add stale thresholds config
- `src/server/project-management/adapters/github.ts` - Add `getItemUpdatedAt()` method

---

## 6. Add PR Size Validation Enforcement

| Priority | Complexity | Size |
|----------|------------|------|
| **Medium** | Low | S |

**Summary:** Tech design specifies phases should be S or M size, but implementation doesn't validate actual PR size.

**Current State:**
- Tech design agent instructs phases to be S/M size
- Implementation agent lists changed files but doesn't validate
- Large PRs (L/XL) can be created for S/M phases

**Size Definitions (Suggested):**

| Size | Files | Lines Changed |
|------|-------|---------------|
| S | ≤ 5 | ≤ 100 |
| M | ≤ 15 | ≤ 500 |
| L | ≤ 30 | ≤ 1000 |
| XL | > 30 | > 1000 |

**Implementation Details:**

1. **Add size validation function:**
   ```typescript
   function validatePRSize(
     changedFiles: string[],
     expectedSize: 'S' | 'M',
   ): { valid: boolean; actualSize: string; message?: string } {
     const fileCount = changedFiles.length;
     const actualSize = fileCount <= 5 ? 'S' : fileCount <= 15 ? 'M' : fileCount <= 30 ? 'L' : 'XL';
     // ...
   }
   ```

2. **Call before PR creation:**
   - If exceeds expected size: Log warning in PR comment
   - Option: Block PR creation for XL phases (configurable)

3. **Include in PR description:**
   ```
   **Size:** M (12 files changed) ✅ Within expected size
   ```

**Files to Modify:**
- `src/agents/core-agents/implementAgent/index.ts` - Add validation
- `src/agents/shared/prompts.ts` - Update PR template to include size

---

## 7. Add Automatic Branch Cleanup After PR Merge ✅ DONE

| Priority | Complexity | Size |
|----------|------------|------|
| **Medium** | Low | S |

**Summary:** Feature branches created during implementation are never deleted after PR merge, causing repository clutter.

**Current State:**
- Implementation agent creates `feature/issue-{N}-*` or `fix/issue-{N}-*` branches
- After PR merge, branches remain indefinitely
- No `deleteBranch()` method in adapter interface

**Implementation Details:**

1. **Add `deleteBranch()` to adapter interface:**
   ```typescript
   // In types.ts
   interface ProjectManagementAdapter {
     // ... existing methods
     deleteBranch(branchName: string): Promise<void>;
   }
   ```

2. **Implement in GitHub adapter:**
   ```typescript
   async deleteBranch(branchName: string): Promise<void> {
     await this.octokit.rest.git.deleteRef({
       owner: this.config.owner,
       repo: this.config.repo,
       ref: `heads/${branchName}`,
     });
   }
   ```

3. **Call after merge in `on-pr-merged.ts`:**
   ```typescript
   // After marking as Done, delete the branch
   const prDetails = await adapter.getPRDetails(prNumber);
   if (prDetails?.headBranch) {
     await adapter.deleteBranch(prDetails.headBranch);
   }
   ```

**Files to Modify:**
- `src/server/project-management/types.ts` - Add interface method
- `src/server/project-management/adapters/github.ts` - Implement method
- `scripts/on-pr-merged.ts` - Call after successful merge

---

## 8. Tech Design: Include Relevant Docs per Phase/File ✅ DONE

| Priority | Complexity | Size |
|----------|------------|------|
| **Medium** | Mid | M |

**Summary:** Tech design output should specify which documentation files and guidelines are relevant for each phase or file being modified.

**Current State:**
- Tech design generates phases with files to modify
- Implementor has generic reference to docs in prompt
- Implementor may miss relevant guidelines, leading to review feedback

**Proposed Enhancement:**

1. **Tech Design Output Expansion:**
   ```typescript
   interface ImplementationPhase {
     order: number;
     name: string;
     description: string;
     files: string[];
     estimatedSize: 'S' | 'M';
     // NEW:
     relevantDocs?: string[];  // e.g., ['docs/theming.md', '.cursor/rules/mongodb-usage.mdc']
     guidelines?: string[];    // Key points to follow
   }
   ```

2. **Smart Doc Matching:**
   - If phase touches `*.tsx` styling → include `docs/theming.md`
   - If phase touches `src/server/database/` → include `docs/mongodb-usage.md`
   - If phase adds API → include `docs/api-endpoint-format.md`
   - If phase modifies stores → include `docs/zustand-stores.md`

3. **Implementation Agent Uses This:**
   - Read the specified docs before implementing
   - Include key guidelines in the implementation prompt
   - Reduces review feedback cycles

**Implementation Approach:**
- Add doc mapping rules in tech design agent
- Could be rule-based (file patterns → docs) or LLM-suggested
- Update phase comment format to include docs
- Update implementation agent to read phase docs

**Files to Modify:**
- `src/agents/core-agents/techDesignAgent/` - Add doc suggestion logic
- `src/agents/lib/phases.ts` - Update phase format
- `src/agents/core-agents/implementAgent/` - Read and use phase docs
- `src/agents/shared/output-schemas.ts` - Update ImplementationPhase type

---

## 9. Workflow Review Slash Command

| Priority | Complexity | Size |
|----------|------------|------|
| **Medium** | Mid | M |

**Summary:** Create a `/review-workflow` command that analyzes a full agent workflow log and suggests improvements.

**Problem Statement:**
- After a feature completes, no structured way to learn from the process
- Repeated issues (same review feedback, same delays) go unnoticed
- No data-driven way to improve prompts or workflow configuration

**Use Cases:**
- After a feature goes through the full pipeline → understand what went well/poorly
- After a particularly slow or buggy feature → identify root causes
- Periodic review of multiple features → spot patterns

**Input Options:**

```bash
# Option 1: By issue number (fetches all data from GitHub + logs)
/review-workflow --issue 43

# Option 2: By agent log file
/review-workflow --log agent-logs/issue-43.md

# Option 3: By PR number (for single-phase features)
/review-workflow --pr 46

# Option 4: Batch analysis (multiple issues)
/review-workflow --issues 40,41,42,43 --summary
```

**Analysis Scope:**

| Category | Data Sources | Metrics |
|----------|--------------|---------|
| **Timeline** | GitHub issue, PR events | Time per phase, total duration, bottlenecks |
| **Quality** | PR reviews, comments | Review cycles, types of feedback, rejection rate |
| **Cost** | Agent logs | Tokens/cost per phase, retries |
| **Accuracy** | PR diff vs requirements | Scope creep, missed requirements, over-engineering |
| **Efficiency** | Agent decisions | Tool calls, exploration depth, false starts |

**Output Format:**

```markdown
# Workflow Review: Issue #43 - Add Dark Mode

## Summary
- **Total Duration:** 5 days (2 days in PR Review)
- **Total Cost:** $4.32 (Tech Design: $0.85, Implementation: $2.47, Reviews: $1.00)
- **Review Cycles:** 3 (2 rejections before approval)

## Timeline
| Phase | Duration | Cost | Notes |
|-------|----------|------|-------|
| Product Design | 4 hours | $0.15 | Clean pass |
| Tech Design | 6 hours | $0.85 | 1 revision |
| Implementation (Phase 1/2) | 8 hours | $1.20 | Clean pass |
| Implementation (Phase 2/2) | 12 hours | $1.27 | 2 review cycles |
| PR Review | 48 hours | $1.00 | **Bottleneck** |

## Issues Identified
1. **Repeated Feedback:** "Use semantic color tokens" appeared in 3 review cycles
   - **Suggestion:** Add theming guidelines to implementation prompt
2. **Scope Creep:** PR included settings page changes not in requirements
   - **Suggestion:** Stricter scope validation in implementation agent
3. **Stale Review:** PR sat in "Waiting for Review" for 36 hours
   - **Suggestion:** Consider auto-pinging reviewers after 24h

## Actionable Improvements
- [ ] Add `docs/theming.md` to implementation prompt for UI changes
- [ ] Enable PR size validation (Phase 2 was L size, expected M)
- [ ] Configure stale detection for PR Review phase
```

**Implementation Approaches:**

**Option A: Claude Code Skill (Recommended)**
- Register as `/review-workflow` skill
- Interactive: can ask follow-up questions
- Can generate and save report

**Option B: Standalone Script**
```bash
yarn review-workflow --issue 43 --output report.md
```

**Option C: Automated Post-Merge Hook**
- Automatically generate brief review after each merge
- Append to `agent-logs/workflow-reviews.md`

**Files to Create/Modify:**
- `src/skills/review-workflow/` - New skill directory
- `src/skills/review-workflow/index.ts` - Skill entry point
- `src/skills/review-workflow/analyzer.ts` - Analysis logic
- `src/skills/review-workflow/templates.ts` - Report templates
- `scripts/review-workflow.ts` - CLI wrapper (optional)

---

## 13. Improve PR Reviewer Commit Message Generation ✅ DONE

| Priority | Complexity | Size | Status |
|----------|------------|------|--------|
| **Medium** | Low | S | ✅ **DONE** |

**Date Added:** 2026-01-25

**Summary:** Improve the commit message format generated by PR Review agent to be more descriptive and follow conventional commit standards.

**Implementation Notes:**

**Current Output (needs improvement):**
```
Title: feat: Improve Feature Requests List UX/UI for Project Management (Phase 4/4)

Body:
## Phase 4/4: Health Indicators & Polish
Add health indicator system (Healthy/Stale/At Risk) based on updatedAt and status...

## Summary
Changes: +164/-27 across 3 files
Phase: 4/4

Closes #43
```

**Improvements needed:**

1. **Better body format:**
   - Separate summary from implementation details
   - Use bullet points for listing changes
   - Clear visual hierarchy

2. **More context (explain WHY, not just WHAT):**
   - Include rationale for changes
   - Explain the problem being solved
   - Note any trade-offs or decisions made

3. **Follow conventional commits:**
   - Proper type prefixes (feat, fix, refactor, etc.)
   - Include scope when relevant
   - Note breaking changes if any
   - Keep title under 72 characters

**Files to Modify:**
- `src/agents/core-agents/prReviewAgent/index.ts` - Update commit message generation
- `src/agents/core-agents/prReviewAgent/createPrReviewerAgentPrompt.ts` - Improve prompt for message quality

---

## 10. Add Cost Budgeting and Alerts ✅ DONE

| Priority | Complexity | Size |
|----------|------------|------|
| **Low** | Mid | M |

**Plan:** `task-manager/plans/task-10-plan.md`

**Summary:** Track and aggregate costs per issue across all workflow phases, with configurable budget alerts.

**Use Cases:**
- See total cost for feature #123 (product design + tech design + implement + reviews)
- Alert when single feature exceeds $10
- Weekly cost report for all processed features

**Implementation Details:**

1. **Cost aggregation by issue:**
   - Agent logs already write per-phase costs to `agent-logs/issue-{N}.md`
   - Create parser to extract and sum costs from log files
   - Store aggregated costs in MongoDB or JSON file

2. **Budget configuration:**
   ```typescript
   // In agents.config.ts or env vars
   const budgetConfig = {
     warningThresholdUSD: 5.00,
     alertThresholdUSD: 10.00,
     weeklyReportEnabled: true,
   };
   ```

3. **Alert integration:**
   - Send Telegram notification when threshold exceeded
   - Include in weekly summary notification

4. **CLI command:**
   ```bash
   yarn agent:costs --issue 123        # Show costs for issue
   yarn agent:costs --summary          # Show all costs
   yarn agent:costs --report weekly    # Generate report
   ```

**Files to Create/Modify:**
- `scripts/agent-costs.ts` - New CLI for cost reporting
- `src/agents/shared/config.ts` - Add budget config
- `src/agents/lib/logging/index.ts` - Add cost extraction helpers

---

## 11. Move Design Documents to Source Code with PR-Based Workflow ✅ DONE

| Priority | Complexity | Size |
|----------|------------|------|
| **High** | High | L |

**Summary:** Transition design document storage from GitHub issue comments to source code files. Design agents create PRs for documents, admin reviews/approves, and documents are linked to issues via pinned comment artifacts.

**Current State:**
- Product Design and Tech Design outputs are posted as GitHub issue comments
- Documents are embedded in issue timeline (hard to track changes, no versioning)
- No structured review workflow for design documents
- Agents read designs from issue comments (fragile, LLM-generated content parsing)

**Proposed Flow:**

1. **Design Agent Workflow:**
   - Generate design document
   - Write to `design-docs/issue-{N}/product-design.md` or `tech-design.md`
   - Create PR with title: `docs: [Product|Tech] Design for #{N} - {Feature Name}`
   - Set status to "Waiting for Review"
   - Wait for admin PR review (approval or changes requested)
   - If changes requested: Update document, push changes, request re-review
   - When approved: Merge PR
   - **CRITICAL:** Status advances ONLY after PR merge event (not approval)

2. **Issue Artifact (Pinned Comment):**
   - After PR merge, agent creates/updates pinned issue comment with marker `<!-- ISSUE_ARTIFACT_V1 -->`
   - Contains links to design document files (source of truth)
   - All subsequent agents read artifact comment to find design docs

3. **Benefits:**
   - Design docs versioned in git with full history
   - Structured PR review instead of ad-hoc comment feedback
   - File diffs easier to review than comment edits
   - Agents read deterministic file paths (reliable)
   - Backward compatible: fallback to comment-based approach

**Document Structure:**
```
design-docs/
├── issue-123/
│   ├── product-design.md
│   └── tech-design.md
└── README.md
```

**Files to Create:**
- `design-docs/README.md` - Explain structure
- `src/server/github/artifact-comments.ts` - Artifact comment helpers
- `src/agents/shared/design-pr-workflow.ts` - Shared PR workflow logic
- `scripts/advance-design-workflow.ts` - Status transition on PR merge

**Files to Modify:**
- `src/agents/core-agents/productDesignAgent/index.ts` - Add PR workflow
- `src/agents/core-agents/techDesignAgent/index.ts` - Add PR workflow
- `src/agents/core-agents/implementAgent/index.ts` - Read from files via artifact
- `src/server/project-management/types.ts` - Add new status values
- `.github/workflows/on-pr-merged.yml` - Add design PR merge handler

---

## 12. Improve Telegram Messages ✅ DONE

| Priority | Complexity | Size |
|----------|------------|------|
| **Low** | Low | S |

> **Completed:** 2026-01-25 - Implemented in commit `fd4af46`

**Summary:** Too many messages cause information overload on Telegram. Need to consolidate and filter notifications.

**Problem Statement:**
- Each agent phase sends individual notifications (start, progress, end)
- Multi-phase features generate 10+ messages
- Hard to distinguish important events from routine updates
- No way to mute specific notification types

**Current Notification Types:**

| Event | Current Behavior | Frequency |
|-------|------------------|-----------|
| Agent started | Individual message | Every agent run |
| Agent completed | Individual message | Every agent run |
| Agent failed | Individual message | On failure |
| PR created | Individual message | Per phase |
| PR review result | Individual message | Per review |
| Rate limit hit | Individual message | When hit |

**Proposed Solutions:**

### Option A: Severity-Based Filtering (Recommended - Simplest)

Only notify for important events:

```typescript
enum NotificationLevel {
  CRITICAL = 'critical',  // Failures, rate limits, stuck items
  INFO = 'info',          // PR created, PR merged, agent completed
  DEBUG = 'debug',        // Agent started, phase started
}

const notificationConfig = {
  minLevel: 'info',  // Only INFO and CRITICAL (skip DEBUG)
};
```

**Impact:** Reduces notifications by ~50%

### Option B: Batched Digests

Collect events and send periodic digests:

```typescript
const batchConfig = {
  enabled: true,
  intervalMinutes: 60,  // Send digest every hour
  immediateFor: ['critical'],  // Still send failures immediately
};
```

**Digest Format:**
```
📊 Agent Activity (Last Hour)

✅ Completed:
- #43 Phase 2 Implementation → PR #47 created
- #42 Tech Design → Approved

🔄 In Progress:
- #43 Phase 3 PR Review

❌ Failed:
- #44 Implementation - Rate limit (retry scheduled)
```

### Option C: Per-Issue Threading

Group all notifications for an issue into a single thread:

```
Issue #43: Add Dark Mode
├─ [10:00] Product Design started
├─ [10:15] Product Design completed ✅
├─ [10:20] Tech Design started
├─ [11:30] Tech Design completed ✅
├─ [11:35] Implementation Phase 1 started
└─ [12:45] PR #47 created
```

**Note:** Requires Telegram topic/thread support or editing previous messages.

### Option D: Notification Preferences (Most Flexible)

User-configurable preferences:

```typescript
const notificationPrefs = {
  // Per-event toggles
  agentStarted: false,
  agentCompleted: true,
  agentFailed: true,
  prCreated: true,
  prMerged: true,
  reviewApproved: true,
  reviewRejected: true,
  rateLimitHit: true,

  // Batching
  batchNonCritical: true,
  batchIntervalMinutes: 30,

  // Quiet hours
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};
```

**Recommendation:** Start with **Option A** (severity filtering) as it's simplest and provides immediate relief. Add **Option B** (batching) if still too noisy.

**Files to Modify:**
- `src/server/telegram/index.ts` - Add filtering logic
- `src/server/telegram/types.ts` - Add NotificationLevel enum
- `src/agents/shared/config.ts` - Add notification preferences
- `src/agents/lib/logging/index.ts` - Tag notifications with severity
