---
title: "Phase 8: Verification & Review"
summary: Verify that all known concerns, edge cases, and awareness items from the design review are properly handled in the final implementation.
---

# Phase 8: Verification & Review

## Goal

After cleanup is complete, systematically verify that every concern raised during the design review (OPEN-QUESTIONS.md awareness items 6–12) has been properly addressed. This phase catches anything that might have been missed or deferred during implementation.

## Dependencies

Phase 7 (cleanup complete — all old code removed, engine is the only path).

## Tasks

### Dual-Write Consistency (Awareness Item #6)

- [ ] **8.1** Verify `syncWorkflowStatus` reconciliation still runs on schedule
  - Confirm the periodic sync job is still registered and active
  - Confirm it reads from the adapter (GitHub Projects) and reconciles with MongoDB
  - Manually trigger a sync and verify it corrects a deliberately introduced drift (test environment only)

- [ ] **8.2** Verify engine error handling on partial dual-write failure
  - Write a test: adapter write succeeds, DB write fails → verify error is thrown and after-hooks don't run
  - Write a test: adapter write fails → verify DB write doesn't execute, no state change
  - Verify the error includes enough context to debug (issue number, transition ID, which write failed)

### Backward Compatibility (Awareness Item #7)

- [ ] **8.3** Verify no internal function-to-function call chains were broken during migration
  - Grep for all calls between migrated functions (e.g., `mergeFinalPR` → `markDone`, `chooseRecommendedOption` → `submitDecisionRouting`)
  - Confirm each callee was migrated before its caller (verify via git log ordering)
  - Run E2E tests that cover these call chains: `merge-final-pr.e2e.test.ts`, `choose-recommended.e2e.test.ts`

### `mergeDesignPR()` Removal (Awareness Item #8)

- [ ] **8.4** Verify `mergeDesignPR()` has no remaining callers
  - Grep entire codebase for `mergeDesignPR` — must return zero results (excluding git history and docs)
  - Verify `design-pr.e2e.test.ts` was updated to use `approveDesign()` or removed
  - If any callers found: migrate them before proceeding

### Review Status Guardrails (Awareness Item #9)

- [ ] **8.5** Verify `engine.updateReviewStatus()` enforces `ReviewFlowDefinition` rules
  - Test: attempt invalid review status transition (e.g., `Approved` → `Waiting for Review`) → verify rejected
  - Test: `approve` action on a design phase triggers `approve-design-{type}` transition via `triggersTransition`
  - Test: review status update on a non-review status → verify rejected with clear error
  - Confirm `agent-log` hook fires on review status changes

### Guard and Hook Registry Completeness (Awareness Item #10)

- [ ] **8.6** Verify all 19 guards and 38 hooks are registered and referenced
  - Run the startup validation that checks every guard/hook ID in pipeline definitions exists in the registry
  - Cross-check: every guard/hook in the registry is referenced by at least one pipeline definition (no orphans)
  - Verify the guard count in `guards-and-hooks.md` (19 guards, 38 hooks) matches the actual registry count

### Pipeline Definition Integrity (Awareness Item #11)

- [ ] **8.7** Verify pipeline definitions match actual runtime behavior
  - For each pipeline definition (feature, bug):
    - Walk every transition in the definition
    - Confirm it has a corresponding E2E or integration test that exercises it
    - Flag any transitions with no test coverage
  - Verify task items (using feature pipeline) are covered by the feature pipeline integration test (Phase 4, task 4.10)
  - Verify the JSONC example files still match the TypeScript const definitions (or mark examples as potentially stale)

### `routeWorkflowItemByWorkflowId()` Wrapper (Awareness Item #12)

- [ ] **8.8** Verify the thin wrapper still works correctly
  - Confirm it resolves workflow-item MongoDB ID to issue number
  - Confirm it delegates to the engine-backed `routeWorkflowItem()`
  - Run the `updateStatus` API handler path that uses this function
  - Verify it returns the same result shape as a direct `routeWorkflowItem()` call

### Cross-Cutting Verification

- [ ] **8.9** Run full E2E test suite — all tests pass
  - All existing E2E tests (12+ test files)
  - New integration tests from Phase 4 (task 4.9)
  - No test modifications needed after Phase 7 cleanup

- [ ] **8.10** Verify no circular dependencies introduced
  - Run `yarn checks` (includes circular dependency detection)
  - Specifically verify: `pipeline/` does not import from old workflow-service files (they should be deleted or thin wrappers)
  - Verify: hooks don't import each other (each hook file is independent)

- [ ] **8.11** Smoke test via Telegram and UI
  - Telegram: approve a feature → route → verify status change in DB
  - Telegram: merge an implementation PR → verify hooks fire (notification, log, DB update)
  - UI: approve a bug → verify auto-route to Bug Investigation
  - UI: submit decision → verify routing to correct destination

- [ ] **8.12** Final documentation review
  - Verify `OPEN-QUESTIONS.md` — all decisions recorded, all awareness items addressed with verification results
  - Update implementation `overview.md` — mark all phases as complete
  - Update `CLAUDE.md` workflow-service section if not already done in Phase 7

## Files to Modify

```
docs/template/github-agents-workflow/new-pipeline-architecture/OPEN-QUESTIONS.md  (add verification results)
docs/template/github-agents-workflow/new-pipeline-architecture/implementation/overview.md  (mark phases complete)
```

## Verification Checklist

| Awareness Item | Task | Status |
|---------------|------|--------|
| #6 Dual-Write Consistency | 8.1, 8.2 | |
| #7 Backward Compatibility | 8.3 | |
| #8 mergeDesignPR Removal | 8.4 | |
| #9 Review Status Guardrails | 8.5 | |
| #10 Guard/Hook Completeness | 8.6 | |
| #11 Pipeline Definition Integrity | 8.7 | |
| #12 routeByWorkflowId Wrapper | 8.8 | |
| Cross-cutting | 8.9–8.12 | |

## Rollback

No rollback needed — this phase makes no code changes, only verifications. If issues are found, they are fixed in-place and re-verified.
