# PR Review Agent

## Purpose

The PR Review Agent reviews pull requests for code quality, correctness, and compliance with project guidelines. For multi-phase implementations, it validates that PRs only implement the specified phase. This agent is meant to run on a schedule (cron job) to automatically review pending PRs.

**Key Responsibilities:**
- Review PRs for code quality and project guideline compliance
- Validate phase-specific implementations (multi-phase features)
- Check TypeScript, React, state management, and UI patterns
- Submit official GitHub PR reviews (APPROVE or REQUEST_CHANGES)
- Post status comment on issue (phase-aware)
- Update Review Status after review
- Consider Claude Code GitHub App feedback (if present, as optional guidance)
- **On approval:** Generate commit message and save to PR comment for admin merge

## Entry Point

**File:** `src/agents/core-agents/prReviewAgent/index.ts`

**Invocation:**
```bash
yarn agent:pr-review                    # Process all pending
yarn agent:pr-review --id <item-id>     # Process specific item
yarn agent:pr-review --dry-run          # Preview without saving
yarn agent:pr-review --stream           # Stream Claude output
yarn agent:pr-review --skip-checkout    # Don't checkout branch (testing)
```

**Cron Job Setup:**
```bash
# Example cron entry (every 15 minutes)
*/15 * * * * cd /path/to/project && yarn agent:pr-review >> /var/log/pr-review.log 2>&1
```

## Integration in Overall Flow

### Position in Pipeline

```
Issue Created
     ↓
   Inbox
     ↓
Product Design (features only)
     ↓
Technical Design
     ↓
Implementation
     ↓
PR Review ← YOU ARE HERE
     ↓
   Done
```

### Trigger Conditions

The agent processes items that match:
1. **Status:** `"PR Review"`
2. **Review Status:** `"Waiting for Review"`
3. **Has PR** (extracts PR number from issue comments)

### Status Transitions

**Input State:**
- Status: `"PR Review"`
- Review Status: `"Waiting for Review"`

**Output States:**

**If approved:**
- Status: `"PR Review"` (unchanged)
- Review Status: `"Approved"`
- Commit message saved to PR comment (marker: `<!-- COMMIT_MESSAGE_V1 -->`)
- Admin notified via Telegram with Merge/Request Changes buttons

**If requesting changes:**
- Status: `"PR Review"` (unchanged)
- Review Status: `"Request Changes"`
- Implementation agent will address feedback

### Automation Setup

**This agent should run on a schedule:**
```bash
# Crontab entry
*/15 * * * * cd /path/to/project && yarn agent:pr-review

# Or systemd timer, Jenkins job, GitHub Actions schedule, etc.
```

**Why scheduled?**
- Automatically reviews new PRs
- No manual triggering needed
- Runs every X minutes to check for pending reviews

## Multi-Phase Workflow Integration

### Phase Detection

```typescript
// Read Implementation Phase from GitHub Project
const existingPhase = await adapter.getImplementationPhase(item.id);
const parsed = parsePhaseString(existingPhase);  // "2/3" → { current: 2, total: 3 }

if (parsed) {
    // Multi-phase feature - get phase details
    const issueComments = await adapter.getIssueComments(issueNumber);
    const phases = parsePhasesFromComment(issueComments) ||
                   extractPhasesFromTechDesign(techDesign);

    const currentPhaseDetails = phases?.find(p => p.order === parsed.current);

    phaseInfo = {
        current: parsed.current,
        total: parsed.total,
        phaseName: currentPhaseDetails?.name,
        phaseDescription: currentPhaseDetails?.description,
        phaseFiles: currentPhaseDetails?.files
    };
}
```

### Phase-Aware Review

When reviewing a multi-phase PR, the agent adds this context to the prompt:

```markdown
## ⚠️ MULTI-PHASE IMPLEMENTATION - PHASE-SPECIFIC REVIEW REQUIRED

**This PR implements Phase 2 of 3**: API Endpoints

**Phase Description:** Implement login, logout, and register endpoints

**Expected Files for this Phase:**
- `src/apis/auth/index.ts`
- `src/pages/api/process/auth_login.ts`
- `src/pages/api/process/auth_logout.ts`

**CRITICAL REVIEW REQUIREMENTS:**
1. ✅ Verify the PR ONLY implements Phase 2 functionality
2. ❌ Flag if the PR implements features from later phases (Phase 3+)
3. ✅ Verify the PR is independently mergeable and testable
4. ✅ Check that the PR follows the phase description above
5. ✅ Verify changes are primarily in the expected files listed above

[...rest of review prompt...]
```

### Finding the Correct PR (Shared Logic with Implementation Agent)

```typescript
// Uses SAME logic as Implementation Agent feedback mode
// Finds the OPEN PR for an issue - returns both PR number AND branch name
const openPR = await adapter.findOpenPRForIssue(issueNumber);

if (!openPR) {
    console.log('No open PR found - skip');
    continue;
}

const { prNumber, branchName } = openPR;
// branchName comes FROM the PR, not regenerated
// Example: feature/issue-123-phase-2-authentication
```

**Why get branch from PR instead of regenerating?**
- Branch name = f(title, phase) - could change after PR creation
- The PR itself KNOWS its actual branch name
- Getting from PR = 100% reliable
- Same logic as Implementation Agent (feedback mode)

## How It Works

### Flow: Review PR

```
1. Fetch GitHub Project item
   - Status: "PR Review"
   - Review Status: "Waiting for Review"

2. Find the OPEN PR for this issue (SHARED LOGIC)
   - Use findOpenPRForIssue(issueNumber)
   - Returns BOTH: prNumber AND branchName
   - If not found → Skip (no open PR to review)

   NOTE: This is the SAME logic used by Implementation Agent
   in feedback mode. Both agents share this function.

3. Detect phase information
   - Read Implementation Phase field
   - If set → Load phase details from comment
   - Add phase context to review

4. Check for uncommitted changes
   - If local changes exist → Error (must be clean)

5. Use branch name from PR
   - Branch name retrieved FROM the open PR
   - More reliable than regenerating (title/phase could change)

6. Checkout feature branch
   - Try local branch first
   - If not found → Fetch from remote
   - Remember original branch for cleanup

7. Fetch PR files from GitHub API ← CRITICAL
   - Use adapter.getPRFiles(prNumber)
   - This is the AUTHORITATIVE list of files in the PR
   - NOT relying on local git diff (which can be misleading)

8. Fetch PR context
   - Get PR conversation comments
   - Get PR review comments (inline code reviews)

9. Build review prompt
   - Add phase context (if multi-phase)
   - Add PR files list from GitHub API ← tells agent exactly which files to review
   - Add PR comments (including Claude Code feedback as optional guidance)
   - Add project guidelines to check

10. Run /review command
    - Uses native /review slash command
    - LLM has access to: Read, Glob, Grep, Bash
    - Can read all code in the checked-out branch
    - Prompt explicitly lists files to review (from GitHub API)
    - Output format: PR_REVIEW_OUTPUT_FORMAT

11. Extract structured output
    - decision: 'approved' | 'request_changes'
    - summary: 1-2 sentence summary
    - reviewText: Full review content

12. Submit official GitHub review
    - Use GitHub API: submitPRReview()
    - Event: APPROVE or REQUEST_CHANGES
    - Body: reviewText (with agent prefix)

13. Post status comment on issue
    - Phase-aware: "✅ **Phase 2/3**: PR approved - ready for merge (#123)"
    - Or: "⚠️ **Phase 1/2**: Changes requested on PR (#123)"

14. Update Review Status
    - If approved → "Approved"
    - If requesting changes → "Request Changes"

15. If approved: Generate and save commit message
    - Fetch PR info (title, body, stats)
    - Generate commit message (title + body)
    - Save/update PR comment with marker: <!-- COMMIT_MESSAGE_V1 -->
    - Overwrites previous comment on re-approval

16. Checkout back to original branch
    - Always cleanup, even on error

17. Send notification
    - If approved: Telegram with commit preview + [Merge] + [Request Changes] buttons
    - If requesting changes: Telegram with decision summary
```

## GitHub Issue Interaction

### Reading from Issue

**Issue Comments:**
1. **PR link comment** (required):
   ```
   Created PR #123
   https://github.com/owner/repo/pull/123
   ```

2. **Phase comment** (if multi-phase):
   ```markdown
   <!-- AGENT_PHASES_V1 -->
   ## Implementation Phases
   [Phase details...]
   ```

**What we read:**
- `extractPRNumber()` - Extracts PR number from comments
- `extractTechDesign()` - Tech design (for context)
- `parsePhasesFromComment()` - Phases from comment (multi-phase)
- `extractPhasesFromTechDesign()` - Phases from markdown (fallback)

### Writing to Issue

**No issue modifications** - This agent only:
- Submits PR review (on the PR itself)
- Updates Review Status field in GitHub Project

## PR Interaction

### Reading from PR

**PR Files (Authoritative List from GitHub API):**
```typescript
const prFiles = await adapter.getPRFiles(prNumber);
// Returns: ['src/client/routes/FeatureRequests/components/FeatureRequestCard.tsx', ...]
```

This is the **authoritative list** of files in the PR:
- Fetched directly from GitHub API (not local git diff)
- Not affected by local branch state
- Not affected by main branch moving forward
- Passed to prompt to tell agent exactly which files to review

**Why this matters:**
- Local `git diff main` can include files that aren't in the PR
- If feature branch is behind main, diff shows extra files
- GitHub API gives the true PR contents

**PR Conversation Comments:**
```typescript
const prConversationComments = await adapter.getPRComments(prNumber);
```

Includes:
- Claude Code GitHub App reviews
- Developer comments
- Other bot comments

**PR Review Comments (Inline):**
```typescript
const prReviewComments = await adapter.getPRReviewComments(prNumber);
```

Format:
```typescript
{
    path: "src/apis/auth/index.ts",
    line: 42,
    body: "Consider adding input validation here",
    author: "claude"
}
```

### Writing to PR

**Submit Official Review:**
```typescript
await adapter.submitPRReview(
    prNumber,
    'APPROVE',  // or 'REQUEST_CHANGES'
    reviewText   // Full review content
);
```

This creates an official GitHub review, not just a comment.

**Review Format:**
```markdown
**[PR Review Agent]**

## Review Decision: APPROVED

I've reviewed the PR and it looks good. Here are my findings:

### ✅ Strengths
- Follows TypeScript guidelines
- Proper error handling
- Good test coverage

### Phase Validation (Phase 2/3)
✅ Only implements Phase 2 functionality (API endpoints)
✅ Changes are in expected files
✅ Independently testable and mergeable

### 📝 Minor Suggestions
- Consider adding JSDoc comments to exported functions

Overall, this PR is ready to merge.
```

## Commit Message Storage (On Approval)

When a PR is approved, the agent generates a commit message and saves it as a PR comment for later use during merge.

### Commit Message Generation

```typescript
import { generateCommitMessage, formatCommitMessageComment } from '@/agents/lib/commitMessage';

// Get PR info for commit message
const prInfo = await adapter.getPRInfo(prNumber);

// Generate commit message (deterministic, no AI)
const commitMsg = generateCommitMessage(prInfo, item.content, phaseInfo);
// Returns: { title: string, body: string }
```

**Commit Message Format:**
```
Title: feat: Add user authentication (same as PR title)

Body:
- Adds login and logout endpoints
- Implements JWT token handling

Changes: +245/-32 across 8 files
Phase: 2/3 (if multi-phase)

Closes #42 (or "Part of #42" for non-final phases)
```

### Saving to PR Comment

```typescript
import { COMMIT_MESSAGE_MARKER } from '@/server/project-management/config';

// Check for existing commit message comment (re-approval scenario)
const existingComment = await adapter.findPRCommentByMarker(prNumber, COMMIT_MESSAGE_MARKER);
const commentBody = formatCommitMessageComment(commitMsg.title, commitMsg.body);

if (existingComment) {
    // Update existing comment (overwrites old commit message)
    await adapter.updatePRComment(prNumber, existingComment.id, commentBody);
} else {
    // Create new comment
    await adapter.addPRComment(prNumber, commentBody);
}
```

**Comment Format:**
```markdown
<!-- COMMIT_MESSAGE_V1 -->
## Commit Message

This commit message will be used when merging this PR:

**Title:**
```
feat: Add user authentication
```

**Body:**
```
- Adds login and logout endpoints
- Implements JWT token handling

Changes: +245/-32 across 8 files

Closes #42
```

---
*Generated by PR Review Agent. Admin will use this when merging.*
```

### Admin Merge via Telegram

After saving the commit message, the agent sends a Telegram notification:

```typescript
await notifyPRReadyToMerge(
    issueTitle,
    issueNumber,
    prNumber,
    commitMsg,    // { title, body }
    issueType     // 'bug' | 'feature'
);
```

**Telegram Message:**
```
PR Review: ✅ Approved!

Issue: Add user authentication (#42)
PR: #123

Commit Message:
`feat: Add user authentication`

- Adds login and logout endpoints
- Implements JWT token handling...

[✅ Merge] [🔄 Request Changes]
[👀 View PR]
```

**Button Actions:**
- **Merge**: Fetches commit message from PR comment, squash merges PR
- **Request Changes**: Status → "Ready for development", Review Status → "Request Changes"

### Re-Approval Behavior

When a PR is re-approved after changes:
1. Agent generates NEW commit message (reflects updated code)
2. Finds existing commit message comment by marker
3. Updates the comment (overwrites old message)
4. Sends new Telegram notification to admin

This ensures the commit message always reflects the current state of the PR.

## Claude Code GitHub App Integration

### Handling Claude's Feedback

All PR comments (including Claude bot comments) are passed together to the prompt. The agent is **required to explicitly respond to Claude's feedback** if present.

**Required Response Format:**
```markdown
### Claude Feedback Response
1. [Claude's point about X] - **AGREE** - Added to changes requested
2. [Claude's point about Y] - **DISAGREE** - This pattern is acceptable because [reason]
```

### Authority Hierarchy

The PR Review Agent is the final authority, but must:
1. **Explicitly acknowledge** each point Claude raised
2. **State AGREE or DISAGREE** for each point
3. **Provide reasoning** for disagreements

This ensures:
- Claude's feedback is never silently ignored
- There's a clear audit trail of why feedback was accepted/rejected
- Valid feedback gets incorporated into the review

## LLM Response Format

### Structured Output Schema

```typescript
{
    type: 'json_schema',
    schema: {
        type: 'object',
        properties: {
            decision: {
                type: 'string',
                enum: ['approved', 'request_changes']
            },
            summary: {
                type: 'string',
                description: '1-2 sentence summary of the review'
            },
            reviewText: {
                type: 'string',
                description: 'Full review content to post as PR comment'
            }
        },
        required: ['decision', 'summary', 'reviewText']
    }
}
```

### Expected Response (Approved)

```json
{
    "decision": "approved",
    "summary": "PR implements Phase 2 correctly with good code quality and proper error handling.",
    "reviewText": "## Review Decision: APPROVED\n\nI've reviewed the PR and it looks good..."
}
```

### Expected Response (Request Changes)

```json
{
    "decision": "request_changes",
    "summary": "PR has a few issues with error handling and implements some Phase 3 features prematurely.",
    "reviewText": "## Review Decision: REQUEST CHANGES\n\nI've found a few issues:\n\n1. ..."
}
```

## Review Guidelines Checked

### Project Guidelines

The agent checks compliance with:
```markdown
**IMPORTANT**: Check compliance with project guidelines in `.ai/skills/`:
- TypeScript guidelines (`.ai/skills/typescript-guidelines/SKILL.md`)
- React patterns (`.ai/skills/react-component-organization/SKILL.md`, `.ai/skills/react-hook-organization/SKILL.md`)
- State management (`.ai/skills/state-management-guidelines/SKILL.md`)
- UI/UX patterns (`.ai/skills/ui-design-guidelines/SKILL.md`, `.ai/skills/shadcn-usage/SKILL.md`)
- File organization (`.ai/skills/feature-based-structure/SKILL.md`)
- API patterns (`.ai/skills/client-server-communications/SKILL.md`)
- Comprehensive checklist (`.ai/skills/app-guidelines-checklist/SKILL.md`)
```

### Phase-Specific Checks (Multi-Phase)

For multi-phase PRs:
```markdown
1. ✅ Verify the PR ONLY implements Phase {current} functionality
2. ❌ Flag if the PR implements features from later phases (Phase {current+1}+)
3. ✅ Verify the PR is independently mergeable and testable
4. ✅ Check that the PR follows the phase description
5. ✅ Verify changes are primarily in the expected files
```

## Status Field Updates

### Review Status Changes

| From | To | Trigger |
|------|----|----|
| `"Waiting for Review"` | `"Approved"` | Review decision: approved |
| `"Waiting for Review"` | `"Request Changes"` | Review decision: request_changes |

### GitHub Project Fields Updated

```typescript
// Update Review Status
const newReviewStatus = decision === 'approved'
    ? REVIEW_STATUSES.approved
    : REVIEW_STATUSES.requestChanges;

await adapter.updateItemReviewStatus(item.id, newReviewStatus);

// Status field NOT changed (stays "PR Review")
// Implementation Phase field NOT changed (stays "2/3" for example)
```

## Connection to Other Agents

### Upstream (Before)

**Implementation Agent:**
- Creates PR
- Posts "@claude please review" comment
- Sets Status: "PR Review", Review Status: "Waiting for Review"
- This agent picks it up

### Downstream (After)

**Admin Merge Flow (via Telegram):**
- On approval → Admin receives Telegram notification with:
  - Commit message preview
  - [Merge] button → Squash merges PR with saved commit message
  - [Request Changes] button → Status = "Ready for development", Review Status = "Request Changes"
  - [View PR] link
- Admin clicks Merge → `on-pr-merged.ts` webhook → Status = "Done"
- Admin clicks Request Changes → Must comment on PR explaining what to fix

**Implementation Agent (Feedback Loop):**
- When Review Status = "Request Changes"
- Status moved back to "Ready for development" (by admin via Telegram)
- Implementation Agent addresses feedback (reads PR comments)
- Creates new commits on same PR
- Sets Review Status = "Waiting for Review", Status = "PR Review"
- This agent re-reviews → generates NEW commit message (overwrites old)

### Parallel

**Claude Code GitHub App:**
- Triggered by "@claude please review" comment
- Provides automated review
- This agent reads Claude's feedback as advisory input

### Webhooks

**PR Merge (After Admin Merges):**
- Webhook updates Implementation Phase (if multi-phase)
- Moves to next phase or Done

## Edge Cases

### 1. No PR Found

**Scenario:** Status = "PR Review" but no PR number in comments

**Handling:**
```typescript
const prNumber = await extractPRNumber(adapter, issueNumber);
if (!prNumber) {
    console.log(`⚠️  Skipping issue #${issueNumber}: No PR found`);
    continue;  // Skip this item
}
```

**Resolution:** Implementation Agent must create PR first

### 2. Uncommitted Local Changes

**Scenario:** Local git workspace has uncommitted changes

**Handling:**
```typescript
if (hasUncommittedChanges()) {
    return { success: false, error: 'Uncommitted changes in working directory. Please commit or stash them first.' };
}
```

**Resolution:** Must be run in clean git workspace

### 3. Branch Doesn't Exist Locally

**Scenario:** Feature branch not in local repository

**Handling:**
```typescript
try {
    checkoutBranch(branchName);
} catch {
    // Try fetching first
    git(`fetch origin ${branchName}:${branchName}`, { silent: true });
    checkoutBranch(branchName);
}
```

**Impact:** Automatically fetches from remote

### 4. Multiple PRs for Same Issue (Multi-Phase)

**Scenario:** Issue has multiple PRs (e.g., Phase 1 merged, Phase 2 open)

**Handling:**
- `findOpenPRForIssue()` searches only OPEN PRs
- Finds the currently OPEN PR (not old merged ones)
- Returns both PR number AND branch name from the PR

**Impact:** Always reviews the correct OPEN PR, even with multiple historical PRs

**Why this works:**
- In multi-phase workflows, only one PR is open at a time
- Phase 1 PR is merged before Phase 2 PR is created
- No risk of reviewing a closed/merged PR

### 5. Claude Code Hasn't Reviewed Yet

**Scenario:** Agent runs before Claude Code GitHub App

**Handling:**
```typescript
if (claudeComments.length === 0) {
    // No Claude feedback - that's fine
    // Review proceeds without it
}
```

**Impact:** Review based only on agent's analysis

### 6. Phase Information Missing

**Scenario:** Multi-phase feature but can't load phase details

**Handling:**
```typescript
if (parsed) {
    const phases = parsePhasesFromComment(issueComments) ||
                   extractPhasesFromTechDesign(techDesign);

    if (!phases) {
        console.warn('Could not load phase details');
        // Review proceeds without phase validation
    }
}
```

**Impact:** Reviews PR but skips phase-specific checks

### 7. PR Already Reviewed

**Scenario:** Running agent twice on same PR

**Handling:**
- No idempotency check
- Submits new review each time
- GitHub shows multiple reviews

**Impact:** Creates duplicate reviews (not ideal but not harmful)

### 8. Checkout Fails

**Scenario:** Can't checkout feature branch

**Handling:**
```typescript
try {
    checkoutBranch(branchName);
} catch (error) {
    console.error('Failed to checkout branch');
    return { success: false, error: 'Checkout failed' };
} finally {
    // Always checkout back to original branch
    checkoutBranch(originalBranch);
}
```

**Impact:** Review fails, original branch restored

## Implementation Details

### Key Dependencies

```typescript
// Project management
import { getProjectManagementAdapter } from '../../shared';

// Parsing
import {
    parsePhaseString,
    extractPhasesFromTechDesign
} from '../../lib/parsing';

// Phases (NEW - reliable phase retrieval)
import {
    parsePhasesFromComment
} from '../../lib/phases';

// Extraction
import {
    extractTechDesign
} from '../../lib';

// Utils
import {
    getIssueType
} from '../../shared';
```

### Git Operations

**Get Current Branch:**
```bash
git branch --show-current
```

**Checkout Branch:**
```bash
git checkout feature/issue-123-phase-2-my-feature
```

**Fetch Remote Branch:**
```bash
git fetch origin feature/issue-123-phase-2-my-feature:feature/issue-123-phase-2-my-feature
```

**Check for Uncommitted Changes:**
```bash
git status --porcelain
```

### Finding Open PR (Shared Logic)

Both PR Review Agent and Implementation Agent (feedback mode) use the same function:

```typescript
// In GitHub adapter: src/server/project-management/adapters/github.ts
async findOpenPRForIssue(issueNumber: number): Promise<{ prNumber: number; branchName: string } | null> {
    // 1. List all OPEN PRs in the repo
    const { data: prs } = await oc.pulls.list({ owner, repo, state: 'open' });

    // 2. Find PRs that reference this issue in their body
    const issuePatterns = [
        /Closes\s+#${issueNumber}\b/i,
        /Part of\s+#${issueNumber}\b/i,
        /#${issueNumber}\b/
    ];

    for (const pr of prs) {
        if (issuePatterns.some(p => p.test(pr.body || ''))) {
            return {
                prNumber: pr.number,
                branchName: pr.head.ref  // Branch name FROM the PR itself
            };
        }
    }

    return null;
}
```

**Why this approach?**
- ✅ Only finds OPEN PRs (ignores old merged PRs)
- ✅ Gets branch name FROM the PR (100% reliable)
- ✅ Works correctly for multi-phase features
- ✅ Shared between agents (single source of truth)

## Configuration

**Agent Config:**
```typescript
// src/agents/agents.config.ts
export const agentConfig = {
    claude: {
        timeoutSeconds: 600,  // 10 minutes max
    }
};
```

**Timeout Override:**
```bash
yarn agent:pr-review --timeout 900  # 15 minutes
```

## CLI Options

```bash
--id <item-id>       # Process specific item by ID
--dry-run            # Preview without saving (no review submission)
--stream             # Stream Claude output in real-time
--verbose            # Show additional debug output
--skip-checkout      # Skip git checkout operations (for testing)
```

## Debugging

**Dry Run Mode:**
```bash
yarn agent:pr-review --dry-run --stream --verbose
```

Shows:
- What branch would be checked out
- What PR comments would be read
- What review would be posted
- What Review Status would be set
- Full LLM response (if --stream)

**Skip Checkout (Testing):**
```bash
yarn agent:pr-review --skip-checkout
```

Useful for:
- Testing prompt logic
- Testing phase detection
- Avoiding git operations

**Common Issues:**

1. **"No PR found"**
   - Check issue comments for "PR #123"
   - Implementation Agent must create PR first

2. **"Uncommitted changes exist"**
   - Fix: `git stash` or commit changes
   - Agent needs clean workspace

3. **"Failed to checkout branch"**
   - Check branch exists: `git branch -a | grep <branch-name>`
   - May need to fetch: `git fetch origin`

4. **Phase validation not happening**
   - Check Implementation Phase field in GitHub Project
   - Check phase comment exists in issue
   - Verify phase data loads correctly

5. **Duplicate reviews**
   - Running agent multiple times creates multiple reviews
   - Not harmful, but clutters PR

## Testing

**Manual Test (Single-Phase):**
```bash
# 1. Have PR created by Implementation Agent
# 2. Status: "PR Review", Review Status: "Waiting for Review"
# 3. Run agent
yarn agent:pr-review --id <item-id> --dry-run --stream

# 4. Verify:
#    - Correct branch checked out
#    - Review content looks good
#    - Decision is reasonable

# 5. Run for real
yarn agent:pr-review --id <item-id>

# 6. Check:
#    - GitHub review posted on PR
#    - Review Status updated
#    - Notification sent
```

**Manual Test (Multi-Phase):**
```bash
# 1. Have Phase 2/3 PR
# 2. Implementation Phase field: "2/3"
# 3. Run agent
yarn agent:pr-review --id <item-id> --dry-run --stream

# 4. Verify:
#    - Prompt includes phase context
#    - Review checks phase boundaries
#    - Detects if Phase 3 features leaked in

# 5. Run for real
yarn agent:pr-review --id <item-id>

# 6. Check:
#    - Review mentions phase validation
#    - Flags any phase boundary violations
```

**Cron Job Test:**
```bash
# 1. Set up cron entry (every 5 min for testing)
*/5 * * * * cd /path/to/project && yarn agent:pr-review >> /tmp/pr-review.log 2>&1

# 2. Create PR
# 3. Wait 5 minutes
# 4. Check log
tail -f /tmp/pr-review.log

# 5. Verify:
#    - Agent ran automatically
#    - Reviewed PR
#    - No errors in log
```

## Cron Job Best Practices

**Recommended Schedule:**
```bash
# Every 15 minutes during work hours
*/15 9-18 * * 1-5 cd /path/to/project && yarn agent:pr-review

# Or 24/7 every 15 minutes
*/15 * * * * cd /path/to/project && yarn agent:pr-review
```

**Logging:**
```bash
# Rotate logs to prevent disk fill-up
*/15 * * * * cd /path/to/project && yarn agent:pr-review >> /var/log/pr-review-$(date +\%Y-\%m-\%d).log 2>&1
```

**Error Notifications:**
```bash
# Email on error (requires mail setup)
*/15 * * * * cd /path/to/project && yarn agent:pr-review || echo "PR Review failed" | mail -s "Agent Error" admin@example.com
```

**Lock File (Prevent Concurrent Runs):**
```bash
#!/bin/bash
LOCKFILE=/tmp/pr-review.lock

if [ -e ${LOCKFILE} ] && kill -0 $(cat ${LOCKFILE}); then
    echo "Already running"
    exit
fi

trap "rm -f ${LOCKFILE}; exit" INT TERM EXIT
echo $$ > ${LOCKFILE}

cd /path/to/project && yarn agent:pr-review
rm -f ${LOCKFILE}
```

## Related Documentation

- **Overall workflow:** `docs/github-projects-integration.md`
- **PR Merge Flow:** `docs/github-projects-integration.md#pr-merge-flow-admin-approval`
- **Multi-PR workflow:** `docs/github-projects-integration.md#multi-pr-workflow-lxl-features`
- **Phase architecture:** `docs/github-projects-integration.md#phase-storage--retrieval`
- **Project guidelines:** `.ai/skills/`
- **Phase utilities:** `src/agents/lib/phases.ts`
- **Commit message utilities:** `src/agents/lib/commitMessage.ts`
- **Telegram webhook handlers:** `src/pages/api/telegram-webhook.ts`
- **Cron setup:** `docs/github-projects-integration.md#pr-review-agent-cron-setup`
