---
title: "Phase 5: Internal Migration"
summary: Refactor each workflow-service function into a thin wrapper around the pipeline engine, one function at a time with E2E validation after each.
---

# Phase 5: Internal Migration

## Goal

Replace each workflow-service function body with a thin wrapper that delegates to `engine.transition()`. Same function signatures, same return types — callers don't know the engine exists. This is the highest-risk phase.

## Dependencies

Phase 4 (engine must be fully implemented).

## Strategy

Migrate **one function at a time**. After each migration:
1. Run `yarn checks` — zero errors
2. Run the full E2E suite — all tests pass
3. If anything fails, investigate before proceeding

Start with the simplest functions and work toward the most complex (`mergeImplementationPR`).

## Tasks

### Entry Operations (Medium Risk)

- [ ] **5.1** Migrate `approveWorkflowItem()` → `engine.transition('approve', ...)`
  - Context carries source doc reference, item type, optional initialRoute
  - If `initialRoute` provided and not 'backlog', fires a second routing transition
  - Preserves return type `ServiceResult`

- [ ] **5.2** Migrate `routeWorkflowItem()` → `engine.transition('route-to-{dest}', ...)`
  - Wrapper resolves routing destination to transition ID
  - Preserves return type `ServiceResult`

- [ ] **5.3** Migrate `deleteWorkflowItem()` → `engine.transition('delete', ...)`
  - Context carries `force` flag for items already synced to GitHub
  - Preserves return type `ServiceResult`

### Simple Status Updates (Low Risk)

- [ ] **5.4** Migrate `setWorkflowStatus()` → `engine.transition('manual-status-set', ...)`
  - Wrapper resolves workflow item, calls engine
  - Preserves return type `ServiceResult`

- [ ] **5.5** Migrate `markClarificationReceived()` → `engine.updateReviewStatus('Clarification Received', ...)`
  - Simple review status update
  - Preserves return type

- [ ] **5.6** Migrate `updateReviewStatus()` / `clearReviewStatus()` → `engine.updateReviewStatus()`
  - Wrapper maps current parameters to engine call
  - `clearReviewStatus` passes empty string

### Advance and Mark Done (Medium Risk)

- [ ] **5.7** Migrate `advanceStatus()` → thin wrapper calling `engine.transition()` with resolved transition ID
  - Must handle the generic nature of this function — callers pass arbitrary status strings
  - Map the status string to a transition ID based on current and target status

- [ ] **5.8** Migrate `markDone()` → `engine.transition('manual-mark-done', ...)`
  - Most side effects are now hooks (source doc update, design PR close, S3 cleanup, log sync)
  - Verify all markDone side effects fire via hooks

- [ ] **5.9** Migrate `autoAdvanceApproved()` → batch `engine.transitionByTrigger(issueNumber, 'admin_review_approve', ...)`
  - Iterates over items with `Approved` review status
  - Each item's transition is resolved via multi-match resolution from pipeline definition
  - Preserves batch result format `{ total, advanced, failed, details }`

### Review and Changes (Medium Risk)

- [ ] **5.10** Migrate `reviewDesign()` → `engine.updateReviewStatus()` with ReviewFlowDefinition
  - Maps action string (`'approve'` | `'changes'` | `'reject'`) to review status update
  - Approve triggers `approve-design-{type}` via review flow's `triggersTransition`

- [ ] **5.11** Migrate `requestChangesOnPR()` → `engine.transition('pr-request-changes', ...)`
  - Sets status to Implementation + review to Request Changes

- [ ] **5.12** Migrate `requestChangesOnDesignPR()` → `engine.transition('design-pr-request-changes', ...)`
  - Only changes review status (status unchanged)

### Design Approval (Medium-High Risk)

- [ ] **5.13** Migrate `approveDesign()` → `engine.transition('approve-design-{type}', ...)`
  - Maps design type to transition ID
  - S3 read, artifact save, phase initialization all via hooks
  - Tech design triggers `hook:initialize-phases`

### Decision and Undo (Medium Risk)

- [ ] **5.14** Migrate `submitDecisionRouting()` → `engine.transition('bug-decision-to-{dest}', ...)`
  - Maps decision routing to appropriate transition
  - Decision without routing sets review status only

- [ ] **5.15** Migrate `chooseRecommendedOption()` → `engine.transition('choose-recommended', ...)`
  - Decision validation via `guard:decision-exists`
  - Target resolved from recommended option's routing config

- [ ] **5.16** Migrate `undoStatusChange()` → `engine.transition('undo-action', ...)`
  - Context carries `restoreStatus` and `restoreReviewStatus`
  - Guard validates time window — if guard fails with undo-window reason, wrapper returns `{ expired: true }`
  - Wrapper checks `result.success` and `result.error` to determine if window expired

### Agent and Phase (Medium Risk)

- [ ] **5.17** Migrate `completeAgentRun()` → `engine.completeAgent()`
  - Engine resolves correct transition from agent type and result
  - Preserves return type

- [ ] **5.18** Migrate `advanceImplementationPhase()` → subsumed by merge transition hooks
  - Not called directly anymore — `hook:advance-implementation-phase` handles this
  - Keep as deprecated wrapper that calls engine internally

- [ ] **5.19** Migrate `clearImplementationPhase()` → subsumed by markDone hooks
  - Same as above — `hook:clear-implementation-phase` handles this

### Merge Operations (High Risk — Most Complex)

- [ ] **5.20** Migrate `mergeImplementationPR()` → `engine.transitionByTrigger(issueNumber, 'admin_merge_pr', ...)`
  - **This is the hardest migration** — 362 lines of current logic
  - Uses `transitionByTrigger` so the engine resolves which merge variant via multi-match resolution (phase guards)
  - Caller does NOT need to determine the specific transition ID — the engine picks `merge-impl-pr`, `merge-impl-pr-next-phase`, or `merge-impl-pr-final` based on guards
  - All side effects extracted to hooks: merge-pr, save-phase-artifact, delete-pr-branch, create-final-pr, etc.
  - Wrapper extracts domain data from `hookResults` using `getHookData()`:
    - `hook:merge-pr` → `mergeCommitSha`
    - `hook:create-final-pr` → `{ prNumber, prUrl }`
    - `hook:advance-implementation-phase` → `phaseInfo`
  - Assembles `MergePRResult` return type from extracted hook data

- [ ] **5.21** Migrate `mergeFinalPR()` → `engine.transition('merge-final-pr', ...)`
  - Calls markDone internally (now via hooks)
  - Branch cleanup via `hook:clean-up-task-branch`

### Revert Operations (Medium-High Risk)

- [ ] **5.22** Migrate `revertMerge()` → `engine.transition('revert-merge', ...)`
  - Revert PR creation via `hook:create-revert-pr`
  - Source doc status revert via `hook:revert-source-doc-status`

- [ ] **5.23** Migrate `mergeRevertPR()` → `engine.transition('merge-revert-pr', ...)`
  - Cleanup via hooks

### Final Validation

After all migrations:

- Run full E2E suite — all tests must pass
- Verify each migrated function preserves identical return types
- Check that no test had to be modified (return type/behavior drift)

## Files to Modify

```
src/server/template/workflow-service/
  approve.ts
  route.ts
  delete.ts
  advance.ts
  review-status.ts
  set-status.ts
  phase.ts
  agent-complete.ts
  decision.ts
  undo.ts
  auto-advance.ts
  design-review.ts
  clarification.ts
  request-changes.ts
  request-changes-design.ts
  choose-recommended.ts
  approve-design.ts
  merge-design-pr.ts
  merge-pr.ts
  merge-final-pr.ts
  revert.ts
```

## Wrapper Pattern

Each function follows the same wrapper pattern — call the engine, then assemble the caller-expected return type from generic engine results:

```typescript
// Before (current implementation in advance.ts)
export async function markDone(issueNumber: number, options?: MarkDoneOptions): Promise<ServiceResult> {
  // 150+ lines of direct logic
}

// After (thin wrapper — simple case, no hook data extraction needed)
export async function markDone(issueNumber: number, options?: MarkDoneOptions): Promise<ServiceResult> {
  const engine = await getPipelineEngine();
  const result = await engine.transition(issueNumber, 'manual-mark-done', {
    actor: 'admin',
    logAction: options?.logAction ?? 'manual_done',
    logDescription: options?.logDescription ?? 'Marked as Done',
  });
  return {
    success: result.success,
    error: result.error,
    advancedTo: result.newStatus,
    previousStatus: result.previousStatus,
  };
}
```

For wrappers that need domain-specific hook data, use `getHookData()`:

```typescript
// After (complex case — merge wrapper uses transitionByTrigger for multi-match resolution)
export async function mergeImplementationPR(issueNumber: number, context: MergeContext): Promise<MergePRResult> {
  const engine = await getPipelineEngine();
  const result = await engine.transitionByTrigger(issueNumber, 'admin_merge_pr', {
    actor: 'admin',
    prNumber: context.prNumber,
    commitMessage: context.commitMessage,
  });
  if (!result.success) return { success: false, error: result.error };

  // Extract domain data from hook results
  const mergeData = getHookData<{ mergeCommitSha: string }>(result, 'hook:merge-pr');
  const finalPr = getHookData<{ prNumber: number; prUrl: string }>(result, 'hook:create-final-pr');
  const phaseInfo = getHookData<{ current: number; total: number }>(result, 'hook:advance-implementation-phase');

  return {
    success: true,
    mergeCommitSha: mergeData?.mergeCommitSha,
    finalPrCreated: finalPr,
    phaseInfo,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
  };
}
```

## Validation

1. `yarn checks` passes after each function migration
2. Full E2E suite passes after each function migration
3. Return types match exactly — no field additions or removals
4. No test modifications needed

## Rollback

Each function can be individually reverted by restoring the old function body from git. The engine continues to work with whichever functions have been migrated.
