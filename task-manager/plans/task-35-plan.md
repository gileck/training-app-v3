# Task 35: Add PR Merge Success Notification with Revert Button - Implementation Plan

## Objective

After clicking "Merge PR" in Telegram and the PR merges successfully, send a follow-up notification showing merge success, current phase state, and action buttons including a Revert option. The Revert button should create a revert PR, update the GitHub Project status back to the previous phase, and send a confirmation message.

## Approach

The implementation follows existing patterns in the codebase for Telegram callbacks and GitHub API integration:

1. **Modify `handleMergeCallback`** in `telegram-webhook.ts` to send a NEW success notification message (in addition to editing the original) with View PR, View Issue, and Revert buttons.

2. **Add a new `handleRevertMerge` callback handler** that creates a revert PR using GitHub API, restores the GitHub Project status, and sends confirmation.

3. **Extend the `ProjectManagementAdapter` interface** to support getting merge commit SHA and creating revert PRs.

**Key Design Decisions:**

- **Revert via PR (not direct commit)**: Safer, allows review, maintains workflow consistency. GitHub's API supports this via creating a branch with reverted changes and opening a PR.

- **Callback data size**: Telegram limits callback_data to 64 bytes. Solution: Use short SHA (7 chars) and encode previous status as abbreviated codes.

- **State restoration logic**:
  - Multi-phase mid-merge: Restore to "PR Review" with same phase (e.g., "2/3")
  - Final phase or single-phase: Restore to "PR Review" (clear phase field)

- **No time limit on Revert**: Unlike the 5-minute undo window for "Request Changes", Revert is a deliberate action that may require time to resolve conflicts.

## Sub-tasks

- [ ] **Sub-task 1: Extend ProjectManagementAdapter interface**
  - Add `getMergeCommitSha(prNumber: number): Promise<string | null>` method to types.ts
  - Add `createRevertPR(mergeCommitSha: string, originalPrNumber: number, issueNumber: number): Promise<{ prNumber: number; url: string }>` method to types.ts

- [ ] **Sub-task 2: Implement GitHub adapter methods**
  - Implement `getMergeCommitSha` in github.ts using `octokit.pulls.get()` which returns `merge_commit_sha`
  - Implement `createRevertPR` in github.ts:
    1. Get the merge commit details
    2. Create a new branch from main
    3. Use `octokit.repos.merge()` or git operations to apply revert
    4. Create PR with title "Revert: [original PR title]"

- [ ] **Sub-task 3: Send merge success notification after successful merge**
  - Modify `handleMergeCallback` in telegram-webhook.ts to send a NEW message after merge completes
  - Message format per task spec:
    - For mid-phase: "Phase X of Y complete. Next: Phase Y+1"
    - For final/single phase: "All phases complete!" or "Feature ready for review"
  - Include inline keyboard with View PR, View Issue, Revert buttons
  - Callback format: `rv:issueNum:prNum:shortSha:prevStatus:phase` (abbreviated to fit 64 bytes)

- [ ] **Sub-task 4: Implement revert callback handler**
  - Add `handleRevertMerge` function in telegram-webhook.ts
  - Parse callback data to extract issue number, PR number, merge commit SHA, previous status, phase
  - Call adapter to create revert PR
  - Update GitHub Project status back to previous status
  - Restore phase field for multi-phase features
  - Update MongoDB status if needed (done -> in_progress/investigating)
  - Send confirmation message with revert PR link

- [ ] **Sub-task 5: Handle revert error cases**
  - Conflict during revert: Return error message suggesting manual intervention
  - PR already reverted: Detect and inform user
  - API failures: Proper error handling with user-friendly messages

- [ ] **Sub-task 6: Update documentation**
  - Add Revert action to telegram-integration.md under Quick Actions
  - Document the revert flow and error scenarios

## Files to Modify

- `src/server/project-management/types.ts` - Add interface methods for `getMergeCommitSha` and `createRevertPR`
- `src/server/project-management/adapters/github.ts` - Implement the new adapter methods
- `src/pages/api/telegram-webhook.ts` - Add merge success notification in `handleMergeCallback`, add new `handleRevertMerge` handler, add callback routing for `rv:` prefix
- `docs/template/github-agents-workflow/telegram-integration.md` - Document new Revert quick action

## Notes

**Callback Data Encoding (64-byte limit):**
```
rv:45:124:abc1234:impl:2/3
```
- `rv` = revert action (2 bytes)
- Issue number (~4 bytes)
- PR number (~4 bytes)
- Short SHA (7 bytes)
- Status abbreviation: `impl`=Implementation, `prrev`=PR Review, `done`=Done (~5 bytes)
- Phase if applicable (~4 bytes)
- Total: ~30 bytes, well within limit

**Status Abbreviation Map:**
- `impl` = Implementation
- `prrev` = PR Review
- `done` = Done
- `pdes` = Product Design
- `tdes` = Tech Design

**MongoDB Status Restoration:**
- Feature requests: `done` -> `in_progress`
- Bug reports: `resolved` -> `investigating`

**Error Messages:**
- Conflict: "Revert failed due to conflicts. Please create revert PR manually."
- Already reverted: "This merge appears to have already been reverted."
- API error: "Failed to create revert PR: [error]. Please try manually."

### Critical Files for Implementation

- `src/pages/api/telegram-webhook.ts` - Core file containing `handleMergeCallback` to modify and new `handleRevertMerge` to add
- `src/server/project-management/adapters/github.ts` - GitHub API implementation for merge commit SHA and revert PR creation
- `src/server/project-management/types.ts` - Interface definitions for new adapter methods
- `src/server/project-management/config.ts` - STATUSES constants for status restoration logic
- `src/agents/shared/notifications.ts` - Pattern reference for notification message formatting
