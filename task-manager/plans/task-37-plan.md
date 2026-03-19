# Task 37: Implement Feature Branch Workflow with Phase PRs - Implementation Plan

## Objective

Refactor the GitHub agents workflow to use feature branches for **multi-phase features only**, providing isolation between concurrent workflows, easier phase reviews, and preview deployments for verification before final merge. Single-phase features remain unchanged.

## Current Architecture

Based on codebase exploration, here is how the system currently works:

### Current Branch Flow
```
main <--- Product Design PR (merged)
main <--- Tech Design PR (merged)
main <--- Phase 1 PR (merged)
main <--- Phase 2 PR (merged)
main <--- Phase 3 PR (merged)
```

### Current GitHub Project Statuses
- `Backlog` - New items, not yet started
- `Product Development` - (Optional) AI transforms vague ideas into product specs
- `Product Design` - AI generates UX/UI design, human reviews
- `Technical Design` - AI generates tech design, human reviews
- `Ready for development` - Implementation (Implementation Phase field tracks multi-PR phases)
- `PR Review` - PR created, awaiting human review/merge
- `Done` - Completed and merged

### Key Components Identified

1. **Implementation Agent** (`src/agents/core-agents/implementAgent/index.ts`)
   - Creates branches: `feature/issue-{N}-phase-{M}-{slug}` or `feature/issue-{N}-{slug}`
   - Creates PRs targeting `main` (via `defaultBranch`)
   - Handles new implementations, feedback addressing, and clarifications
   - Uses `generateBranchName()` for branch naming

2. **PR Review Agent** (`src/agents/core-agents/prReviewAgent/index.ts`)
   - Reviews PRs in "PR Review" status with "Waiting for Review"
   - Submits GitHub PR reviews (APPROVE or REQUEST_CHANGES)
   - Generates commit messages for merge

3. **GitHub Adapter** (`src/server/template/project-management/adapters/github.ts`)
   - `createPullRequest(head, base, title, body, reviewers)` - base branch is configurable
   - `findOpenPRForIssue()` - finds open PRs referencing an issue
   - `mergePullRequest()` - squash merges PRs
   - `createBranch()`, `deleteBranch()`, `branchExists()` - branch management

4. **Telegram Webhook** (`src/pages/api/telegram-webhook.ts`)
   - Handles merge actions via callback buttons
   - Primary merge handler (GitHub Action is disabled)

5. **Multi-Phase System** (`src/agents/lib/phases.ts`, `src/agents/lib/artifacts.ts`)
   - Tracks phase progress via `Implementation Phase` field in GitHub Projects
   - Stores phase info in artifact comments on issues
   - Format: `Phase X/Y: Name`

## Approach

### Key Decision: Design to Main, Implementation Splits by Phase Count

Since phases are only determined during Tech Design, we use this approach:
- **Design docs (Product Design, Tech Design)**: Always PR to main (no change)
- **Single-phase implementation**: PR to main (no change)
- **Multi-phase implementation**: Feature branch + Final Review status

This minimizes changes while providing isolation where it matters most.

### New Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DESIGN PHASE                                    │
│                         (Always to main - NO CHANGE)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Product Design PR → main → Tech Design PR → main                           │
│                                     │                                        │
│                              Phases determined                               │
│                                     │                                        │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────────┐
│         SINGLE-PHASE              │ │            MULTI-PHASE                 │
│       (NO CHANGE - to main)       │ │      (NEW - feature branch)            │
├───────────────────────────────────┤ ├───────────────────────────────────────┤
│                                   │ │                                        │
│   Ready for Dev                   │ │   Ready for Dev (Phase 1/N)            │
│        │                          │ │        │                               │
│   Implementation PR → main        │ │   feature/task-{id} created            │
│        │                          │ │        │                               │
│   PR Review                       │ │   Phase 1 PR → feature branch          │
│        │                          │ │        │                               │
│   Merged → Done                   │ │   PR Review → Merged to feature        │
│                                   │ │        │                               │
│                                   │ │   Ready for Dev (Phase 2/N)            │
│                                   │ │        │                               │
│                                   │ │   ... repeat for all phases ...        │
│                                   │ │        │                               │
│                                   │ │   Last phase merged to feature         │
│                                   │ │        │                               │
│                                   │ │   Final PR: feature → main             │
│                                   │ │        │                               │
│                                   │ │   *** Final Review *** (NEW STATUS)    │
│                                   │ │        │                               │
│                                   │ │   Admin verifies preview → Merges      │
│                                   │ │        │                               │
│                                   │ │   Done                                 │
└───────────────────────────────────┘ └───────────────────────────────────────┘
```

### New GitHub Project Status: "Final Review"

Add new status between "PR Review" and "Done" for multi-phase features:

| Status | Description | Used By |
|--------|-------------|---------|
| PR Review | Phase PR being reviewed by PR Review Agent | Single & Multi-phase |
| **Final Review** *(NEW)* | Final PR from feature branch to main, admin verifies complete feature | Multi-phase only |
| Done | Merged to main | Single & Multi-phase |

### Status Flow Comparison

**Single-Phase (No Change):**
```
Ready for Dev → PR Review → Done
```

**Multi-Phase (New):**
```
Ready for Dev → PR Review → Ready for Dev → PR Review → ... → Final Review → Done
     (1/N)        (phase 1)      (2/N)        (phase 2)         (final PR)
```

### Architectural Decisions

1. **When to create feature branch**: At start of implementation for multi-phase only (after Tech Design determines phases)
2. **Design docs**: Always to main (no change) - we don't know phase count yet
3. **Single-phase**: Direct to main (no change) - no feature branch overhead
4. **Multi-phase**: Feature branch for isolation, Final Review for admin verification
5. **Branch naming**: `feature/task-{issueId}` for task branch, `feature/task-{issueId}-phase-{N}` for phase branches
6. **Final PR creation**: Automatic after last phase merges to feature branch
7. **Preview URL**: Include in Final Review notification for admin verification

### Logging Requirements

All new feature branch operations MUST be logged to the issue logger for debugging. Use new log markers:

| Marker | Usage |
|--------|-------|
| `[LOG:FEATURE_BRANCH]` | All feature branch operations (create, PR targeting, merge, cleanup) |
| `[LOG:FINAL_REVIEW]` | Final review status transitions and notifications |

**Required Log Points:**

```
# At implementation start (multi-phase detection)
[LOG:FEATURE_BRANCH] Detected multi-phase feature: {phases.total} phases
[LOG:FEATURE_BRANCH] Creating feature branch: feature/task-{issueId} from main

# At each phase implementation
[LOG:FEATURE_BRANCH] Creating phase branch: feature/task-{issueId}-phase-{N} from feature/task-{issueId}
[LOG:FEATURE_BRANCH] PR #{prNumber} targeting feature branch: {phaseBranch} → {taskBranch}

# At phase merge (Telegram webhook)
[LOG:FEATURE_BRANCH] Merging phase PR #{prNumber} to feature branch
[LOG:FEATURE_BRANCH] Phase {current}/{total} complete

# At last phase merge
[LOG:FEATURE_BRANCH] All phases complete, creating final PR
[LOG:FEATURE_BRANCH] Final PR #{prNumber} created: feature/task-{issueId} → main
[LOG:FINAL_REVIEW] Status transition: PR Review → Final Review

# At final merge
[LOG:FINAL_REVIEW] Admin merging final PR #{prNumber}
[LOG:FEATURE_BRANCH] Cleaning up branches for task-{issueId}
[LOG:FEATURE_BRANCH] Deleted branch: feature/task-{issueId}-phase-{N}
[LOG:FEATURE_BRANCH] Deleted branch: feature/task-{issueId}
[LOG:FINAL_REVIEW] Status transition: Final Review → Done

# Error cases
[LOG:ERROR] [FEATURE_BRANCH] Failed to create branch: {reason}
[LOG:ERROR] [FEATURE_BRANCH] Failed to create PR: {reason}
[LOG:ERROR] [FEATURE_BRANCH] Failed to merge: {reason}
[LOG:ERROR] [FEATURE_BRANCH] Failed to delete branch: {reason}
```

**Error Log Requirements:**
- Include issue number and phase context
- Include expected vs actual state
- Include suggested recovery steps
- Use `[LOG:ERROR]` with `[FEATURE_BRANCH]` context for grep filtering

## Sub-tasks

### Sub-task 1: Add "Final Review" Status to GitHub Projects
- [ ] Add `Final Review` status/column to GitHub Projects (manually in GitHub UI)
- [ ] Update `STATUSES` constant in `src/server/template/project-management/config.ts`
- [ ] Position between "PR Review" and "Done"
- [ ] Update `docs/template/init-github-projects-workflow.md`:
  - Add "Final Review" to Status column table
  - Document when this status is used (multi-phase only)
  - Add to troubleshooting section if missing
- [ ] Update `scripts/template/verify-github-projects-setup.ts`:
  - Update expected status count from 6 to 7 (or 8 with Product Development)
  - Add verification that "Final Review" exists
  - Add helpful error message if missing

### Sub-task 2: Add Task Branch Tracking Infrastructure
- [ ] Update `ArtifactComment` type to include `taskBranch` field
- [ ] Add `getTaskBranch()` and `setTaskBranch()` helper functions
- [ ] Store task branch name in artifact comment on the issue

### Sub-task 3: Modify Implementation Agent - Feature Branch Creation (Multi-Phase Only)
- [ ] Detect if multi-phase (phases.total > 1) at implementation start
- [ ] Create `feature/task-{issueId}` branch from main for multi-phase
- [ ] Store task branch name in artifact comment
- [ ] Single-phase: no change (continue using main as base)

### Sub-task 4: Modify Implementation Agent - PR Creation
- [ ] For multi-phase: Create phase branches off task branch
- [ ] For multi-phase: PR targets task branch (not main)
- [ ] For single-phase: No change (PR targets main)
- [ ] Update `generateBranchName()` to handle both flows

### Sub-task 5: Update Phase PR Merge Handler (Telegram Webhook)
- [ ] Detect if PR targets feature branch vs main
- [ ] For phase PRs to feature branch: merge, advance phase counter
- [ ] After last phase merges to feature branch: trigger final PR creation
- [ ] For single-phase to main: no change (current behavior)

### Sub-task 6: Create Final PR Logic
- [ ] After last phase merges to feature branch, auto-create PR to main
- [ ] Set status to "Final Review" (new status)
- [ ] Include comprehensive PR description:
  - All phase summaries
  - Links to phase PRs
  - Design doc references
- [ ] Notify admin with preview URL

### Sub-task 7: Update Final PR Merge Handler
- [ ] Handle merge of final PR (feature branch → main)
- [ ] Move status from "Final Review" to "Done"
- [ ] Delete feature branch and all phase branches
- [ ] Update artifact comment with completion info

### Sub-task 8: Add Vercel Preview URL to Final Review Notification
- [ ] Get preview deployment URL for final PR
- [ ] Include preview URL in Telegram notification
- [ ] Add "Open Preview" button alongside Merge/Reject buttons

### Sub-task 9: Update Notifications
- [ ] Add `notifyFinalReviewReady()` for when final PR is created
- [ ] Include preview URL and feature summary
- [ ] Update merge notification to indicate "merged to main"

### Sub-task 10: Update PR Review Agent (Minor)
- [ ] No logic changes needed (still reviews code in PRs)
- [ ] Ensure it handles PRs targeting feature branches correctly
- [ ] Skip any main-branch-specific checks if applicable

### Sub-task 11: Branch Cleanup
- [ ] Delete phase branches after merge to feature branch
- [ ] Delete feature branch after final PR merges to main
- [ ] Handle cleanup on rejection/abandonment

### Sub-task 12: Add Extensive Logging Throughout New Flow
- [ ] Add `[LOG:FEATURE_BRANCH]` marker for feature branch operations
- [ ] Log each step with informative context for debugging:
  - `[LOG:FEATURE_BRANCH] Creating feature branch: feature/task-{id} from main`
  - `[LOG:FEATURE_BRANCH] Phase branch: feature/task-{id}-phase-{N} from feature/task-{id}`
  - `[LOG:FEATURE_BRANCH] PR targeting feature branch: {phaseBranch} → {taskBranch}`
  - `[LOG:FEATURE_BRANCH] Phase {N}/{total} merged to feature branch`
  - `[LOG:FEATURE_BRANCH] Last phase complete, creating final PR`
  - `[LOG:FEATURE_BRANCH] Final PR created: feature/task-{id} → main (PR #{prNumber})`
  - `[LOG:FEATURE_BRANCH] Final PR merged, cleaning up branches`
  - `[LOG:FEATURE_BRANCH] Deleted branch: {branchName}`
- [ ] Log artifact updates when storing/retrieving task branch
- [ ] Log detection of single-phase vs multi-phase at implementation start
- [ ] Include issue number, phase info, and branch names in all log entries

### Sub-task 13: Add Error Handling with Informative Messages
- [ ] Handle feature branch creation failures:
  - Branch already exists (recover or error with context)
  - Permission denied (clear error message)
  - Network failures (retry logic with logging)
- [ ] Handle phase PR creation failures:
  - Base branch doesn't exist (log expected vs actual)
  - Merge conflicts (log conflicting files)
- [ ] Handle final PR creation failures:
  - Feature branch missing (log recovery steps)
  - No changes to merge (log phase merge status)
- [ ] Handle merge failures:
  - Merge conflicts (log files, suggest resolution)
  - Branch protection rules (log which rules blocked)
- [ ] Handle branch cleanup failures:
  - Branch doesn't exist (warn, continue)
  - Permission denied (log, continue with remaining cleanup)
- [ ] All errors should include:
  - Issue number and phase context
  - Expected vs actual state
  - Suggested recovery steps
  - Link to relevant log entries

### Sub-task 14: Update /workflow-review Command for Feature Branch Validation
- [ ] Add new log markers to `.ai/commands/workflow-review.md`:
  - `[LOG:FEATURE_BRANCH]` - Feature branch operations
  - `[LOG:FINAL_REVIEW]` - Final review status transitions
- [ ] Add Feature Branch Flow validation checklist:
  - Verify feature branch created for multi-phase
  - Verify phase PRs target feature branch (not main)
  - Verify final PR created after last phase
  - Verify Final Review status set correctly
  - Verify branch cleanup after merge
- [ ] Add grep patterns for new flow:
  - `\[LOG:FEATURE_BRANCH\]` - All feature branch operations
  - `\[LOG:FEATURE_BRANCH\].*Creating feature branch` - Branch creation
  - `\[LOG:FEATURE_BRANCH\].*targeting feature branch` - PR targeting
  - `\[LOG:FEATURE_BRANCH\].*Final PR` - Final PR operations
  - `\[LOG:FINAL_REVIEW\]` - Final review transitions
- [ ] Add validation for common issues:
  - Phase PR targeting main instead of feature branch (error)
  - Feature branch not created for multi-phase (error)
  - Final PR not created after last phase (error)
  - Branches not cleaned up after merge (warning)
- [ ] Update example output to show feature branch flow analysis

### Sub-task 15: Update Documentation - E2E Flows
- [ ] Update `docs/template/github-agents-workflow/multi-phase-features.md`
  - Document new feature branch flow
  - Add E2E flow diagrams for multi-phase
  - Document Final Review status and admin verification
- [ ] Update `docs/template/github-agents-workflow/workflow-overview.md`
  - Add section on single-phase vs multi-phase differences
  - Document when feature branches are used
- [ ] Create new doc: `docs/template/github-agents-workflow/feature-branch-workflow.md`
  - Complete E2E flow with diagrams
  - Branch naming conventions
  - Final Review process
  - Preview deployment verification
  - Troubleshooting guide
- [ ] Update status flow diagrams in existing docs
- [ ] Document the new "Final Review" GitHub Project column

## Files to Modify

### Core Agent Files
- `src/agents/core-agents/implementAgent/index.ts` - Feature branch creation, PR targeting (multi-phase only)
- `src/agents/core-agents/prReviewAgent/index.ts` - Minor updates for feature branch PRs (if needed)

### Infrastructure Files
- `src/server/template/project-management/config.ts` - Add "Final Review" status
- `src/server/template/project-management/adapters/github.ts` - May need minor updates for branch operations
- `src/server/template/project-management/types.ts` - Update status types if needed

### Merge/Webhook Handling
- `src/pages/api/telegram-webhook.ts` - Handle phase merges, final PR creation, Final Review merge

### Artifact/Phase Tracking
- `src/agents/lib/artifacts.ts` - Add task branch to artifact comment

### Notifications
- `src/agents/shared/notifications.ts` - Add Final Review notification with preview URL

### Documentation
- `docs/template/github-agents-workflow/multi-phase-features.md` - Update with new flow
- `docs/template/github-agents-workflow/workflow-overview.md` - Add single vs multi-phase section
- `docs/template/github-agents-workflow/feature-branch-workflow.md` - New comprehensive doc

### Workflow Review Command
- `.ai/commands/workflow-review.md` - Add feature branch flow validation

## Files NOT Modified (No Change)

These files remain unchanged because design docs and single-phase features use existing flow:

- `src/agents/core-agents/productDesignAgent/index.ts` - No change (PR to main)
- `src/agents/core-agents/techDesignAgent/index.ts` - No change (PR to main)
- Design review handling in Telegram webhook - No change

## Testing Strategy

1. **Unit Testing**
   - Test phase count detection (single vs multi)
   - Test branch name generation for both flows
   - Test artifact comment parsing with task branch field

2. **Integration Testing - Single-Phase**
   - Verify single-phase workflow unchanged
   - PR goes directly to main
   - No feature branch created
   - Status: Ready for Dev → PR Review → Done
   - No `[LOG:FEATURE_BRANCH]` entries in log

3. **Integration Testing - Multi-Phase**
   - Feature branch created at implementation start
   - Phase PRs target feature branch
   - Final PR created after last phase
   - Status includes Final Review
   - Preview URL in notification
   - All `[LOG:FEATURE_BRANCH]` entries present in log

4. **Manual Verification**
   - Run complete multi-phase workflow
   - Verify Vercel preview works for final PR
   - Test admin merge flow from Final Review
   - Verify branch cleanup after merge

5. **Log Verification with /workflow-review**
   - Run `/workflow-review {issueNumber}` after multi-phase workflow
   - Verify feature branch checklist passes:
     - [ ] Feature branch created for multi-phase
     - [ ] Phase PRs target feature branch (not main)
     - [ ] Final PR created after last phase
     - [ ] Final Review status set correctly
     - [ ] Branch cleanup after merge
   - Verify no errors in `[LOG:FEATURE_BRANCH]` entries
   - Verify all expected log points are present

## Risks and Mitigations

### Risk 1: Detecting Multi-Phase Correctly
**Mitigation**: Use `phases.total > 1` check. This is already determined by Tech Design agent and stored in artifact comment.

### Risk 2: Preview Deployment Timing
**Mitigation**: Vercel creates previews for all PRs. May need to wait for deployment or poll for URL. Fallback to PR link if preview not ready.

### Risk 3: Branch Cleanup on Abandonment
**Mitigation**: Add cleanup logic for when issues are rejected or abandoned. Consider periodic cleanup job for orphaned branches.

### Risk 4: Existing Multi-Phase Issues In Progress
**Mitigation**: Document migration steps. Existing issues continue with old flow until completion. New issues use new flow.

### Risk 5: Telegram Webhook Complexity
**Mitigation**: Clearly separate handling for:
1. Design PR merge (to main) - no change
2. Single-phase implementation PR merge (to main) - no change
3. Multi-phase PR merge (to feature branch) - new logic
4. Final PR merge (feature to main) - new logic

## E2E Flow: Multi-Phase Feature (Complete)

```
1. Issue created in Backlog
   └── Admin moves to Product Design

2. Product Design
   ├── Agent creates product-design branch
   ├── Agent creates PR: product-design → main
   ├── Admin reviews (line comments available)
   ├── Admin approves → PR merged to main
   └── Status → Technical Design

3. Technical Design
   ├── Agent creates tech-design branch
   ├── Agent creates PR: tech-design → main
   ├── Agent determines phases (e.g., 3 phases)
   ├── Phases stored in artifact comment
   ├── Admin reviews (line comments available)
   ├── Admin approves → PR merged to main
   └── Status → Ready for Development (Phase 1/3)

4. Implementation Phase 1
   ├── Agent detects multi-phase (3 phases)
   ├── Agent creates feature/task-{id} branch from main ← NEW
   ├── Agent creates feature/task-{id}-phase-1 branch from feature branch
   ├── Agent implements phase 1
   ├── Agent creates PR: phase-1 → feature/task-{id} ← NEW (targets feature branch)
   ├── Status → PR Review
   ├── PR Review Agent reviews code
   ├── Agent approved → Admin merges to feature branch ← NEW
   └── Status → Ready for Development (Phase 2/3)

5. Implementation Phase 2
   ├── Agent creates feature/task-{id}-phase-2 from feature branch
   ├── Agent implements phase 2
   ├── Agent creates PR: phase-2 → feature/task-{id}
   ├── Status → PR Review
   ├── PR Review Agent reviews
   ├── Admin merges to feature branch
   └── Status → Ready for Development (Phase 3/3)

6. Implementation Phase 3 (Final)
   ├── Agent creates feature/task-{id}-phase-3 from feature branch
   ├── Agent implements phase 3
   ├── Agent creates PR: phase-3 → feature/task-{id}
   ├── Status → PR Review
   ├── PR Review Agent reviews
   ├── Admin merges to feature branch
   └── Triggers final PR creation ← NEW

7. Final Review ← NEW STATUS
   ├── System creates PR: feature/task-{id} → main
   ├── PR includes all phase changes + design references
   ├── Status → Final Review
   ├── Telegram notification with:
   │   ├── Preview deployment URL
   │   ├── Feature summary
   │   └── Merge / Reject buttons
   ├── Admin verifies complete feature via preview
   └── Admin clicks Merge

8. Completion
   ├── Final PR merged to main
   ├── Status → Done
   ├── Feature branch deleted
   ├── Phase branches deleted
   └── Completion notification sent
```

## E2E Flow: Single-Phase Feature (No Change)

```
1. Issue created in Backlog
   └── Admin moves to Product Design

2. Product Design
   ├── Agent creates PR → main
   ├── Admin reviews → merged
   └── Status → Technical Design

3. Technical Design
   ├── Agent creates PR → main
   ├── Agent determines: 1 phase (single-phase)
   ├── Admin reviews → merged
   └── Status → Ready for Development (no phase indicator)

4. Implementation
   ├── Agent creates feature/issue-{id} branch from main
   ├── Agent implements feature
   ├── Agent creates PR → main (direct, no feature branch)
   ├── Status → PR Review
   ├── PR Review Agent reviews
   ├── Admin merges → main
   └── Status → Done

(No Final Review status - same as current behavior)
```

## Notes

### Trade-offs
- **Minimal changes**: Only implementation agent and merge handler change significantly
- **Design agents untouched**: No risk of breaking design review flow
- **Single-phase unchanged**: Fast path for simple features preserved
- **Multi-phase gets isolation**: Worth the extra PR for complex features

### Backward Compatibility
- Single-phase features: No change at all
- Design phase: No change at all
- Multi-phase implementation: New flow with feature branches
- Existing in-progress issues: Continue with old flow

### Critical Files for Implementation

The 6 most critical files for implementing this plan:

1. `src/agents/core-agents/implementAgent/index.ts` - Feature branch creation and PR targeting for multi-phase
2. `src/pages/api/telegram-webhook.ts` - Handle phase merges to feature branch, final PR creation, Final Review merge
3. `src/server/template/project-management/config.ts` - Add "Final Review" status
4. `src/agents/lib/artifacts.ts` - Track task branch in artifact comment
5. `src/agents/shared/notifications.ts` - Final Review notification with preview URL
6. `.ai/commands/workflow-review.md` - Add feature branch flow validation and new log markers
